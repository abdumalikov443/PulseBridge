import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId, PipelineStage } from "mongoose";
import { Doctor, Doctors } from "../../libs/dto/doctor/doctor";
import { DoctorsInquiry, JoinRequestUpdate } from "../../libs/dto/doctor/doctor.input";
import { ClinicJoinRequest, ClinicJoinRequests } from "../../libs/dto/doctor/join-request";
import { JoinRequestStatus } from "../../libs/enums/doctor.enum";
import { DoctorUpdate } from "../../libs/dto/doctor/doctor.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { LikeInput } from "../../libs/dto/like/like.input";
import { Direction, Message } from "../../libs/enums/common.enum";
import { MemberStatus } from "../../libs/enums/member.enum";
import { ClinicStatus } from "../../libs/enums/clinic.enum";
import { AppointmentStatus } from "../../libs/enums/appointment.enum";
import { ViewGroup } from "../../libs/enums/view.enum";
import { LikeGroup } from "../../libs/enums/like.enum";
import { StatisticModifier, T } from "../../libs/types/common";
import { lookupAuthMemberFollowed, lookupAuthMemberLiked, lookupClinic, lookupDoctor, lookupMember, shapeIntoMongoObjectId, shapeIntoSearchRegex } from "../../libs/config";
import { ClinicService } from "../clinic/clinic.service";
import { ViewService } from "../view/view.service";
import { LikeService } from "../like/like.service";
import { NotificationService } from "../notification/notification.service";
import { NotificationGroup, NotificationType } from "../../libs/enums/notification.enum";

@Injectable()
export class DoctorService {
    constructor (
        @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
        @InjectModel("ClinicJoinRequest") private readonly requestModel: Model<ClinicJoinRequest>,
        @InjectModel("Appointment") private readonly appointmentModel: Model<any>,
        @InjectModel("Follow") private readonly followModel: Model<any>,
        private clinicService: ClinicService,
        private viewService: ViewService,
        private likeService: LikeService,
        private notificationService: NotificationService
    ) {}

    /** JOIN REQUESTS **/

    // doctor without a clinic asks an active clinic; one pending request at a time
    public async requestJoinClinic(memberId: ObjectId, clinicId: ObjectId): Promise<ClinicJoinRequest> {
        const doctor = await this.getDoctorProfileByMember(memberId);
        if (doctor.clinicId) throw new BadRequestException(Message.DOCTOR_HAS_CLINIC);
        const clinic = await this.clinicService.getClinic(null as unknown as ObjectId, clinicId);

        const pending = await this.requestModel.exists({ doctorId: doctor._id, requestStatus: JoinRequestStatus.PENDING }).exec();
        if (pending) throw new BadRequestException(Message.DOCTOR_REQUEST_EXISTS);

        let result: ClinicJoinRequest;
        try {
            result = await this.requestModel.create({ doctorId: doctor._id, clinicId: clinic._id });
        } catch (err: any) {
            console.log("Error, Service.model: ", err.message);
            // unique index: two requests sent at the same moment
            if (err.code === 11000) throw new BadRequestException(Message.DOCTOR_REQUEST_EXISTS);
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        await this.notificationService.createNotification({
            notificationType: NotificationType.DOCTOR_REQUEST,
            notificationGroup: NotificationGroup.CLINIC,
            notificationTitle: "New doctor request",
            notificationDesc: `A doctor wants to join ${clinic.clinicName}`,
            authorId: memberId,
            receiverId: clinic.memberId,
        });
        return result;
    }

    public async cancelJoinRequest(memberId: ObjectId, requestId: ObjectId): Promise<ClinicJoinRequest> {
        const doctor = await this.getDoctorProfileByMember(memberId);
        const result = await this.requestModel
            .findOneAndDelete({ _id: requestId, doctorId: doctor._id, requestStatus: JoinRequestStatus.PENDING })
            .exec();
        if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result;
    }

    // doctor's own requests (any status) with the requested clinic
    public async getMyJoinRequests(memberId: ObjectId, input: OrdinaryInquiry): Promise<ClinicJoinRequests> {
        const doctor = await this.getDoctorProfileByMember(memberId);
        return await this.getJoinRequestList({ doctorId: doctor._id }, input, [
            lookupClinic,
            { $unwind: { path: '$clinicData', preserveNullAndEmptyArrays: true } },
        ]);
    }

    // pending requests to the owner's clinic with the doctor and his member data
    public async getClinicJoinRequests(ownerId: ObjectId, input: OrdinaryInquiry): Promise<ClinicJoinRequests> {
        const clinic = await this.clinicService.getMyClinic(ownerId);
        return await this.getJoinRequestList({ clinicId: clinic._id, requestStatus: JoinRequestStatus.PENDING }, input, [
            lookupDoctor,
            { $unwind: '$doctorData' },
        ]);
    }

    private async getJoinRequestList(match: T, input: OrdinaryInquiry, lookups: PipelineStage.FacetPipelineStage[]): Promise<ClinicJoinRequests> {
        const result = await this.requestModel
            .aggregate([
                { $match: match },
                { $sort: { updatedAt: Direction.DESC } },
                {
                    $facet: {
                        list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }, ...lookups],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    // only the owner of the requested clinic answers, and only PENDING requests
    public async respondJoinRequest(ownerId: ObjectId, input: JoinRequestUpdate): Promise<ClinicJoinRequest> {
        const clinic = await this.clinicService.getMyClinic(ownerId);
        // claim the request first: a concurrent cancel or second answer cannot change it anymore
        const result = await this.requestModel
            .findOneAndUpdate(
                { _id: input._id, clinicId: clinic._id, requestStatus: JoinRequestStatus.PENDING },
                { requestStatus: input.requestStatus },
                { new: true },
            )
            .exec();
        if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const approved = input.requestStatus === JoinRequestStatus.APPROVED;
        const doctor = await this.getDoctorById(result.doctorId);
        if (approved) {
            // only a doctor without a clinic can be attached
            const attached = await this.doctorModel
                .findOneAndUpdate({ _id: result.doctorId, clinicId: null }, { clinicId: clinic._id })
                .exec();
            if (!attached) {
                await this.requestModel.updateOne({ _id: result._id }, { requestStatus: JoinRequestStatus.PENDING }).exec();
                throw new BadRequestException(Message.DOCTOR_HAS_CLINIC);
            }
            await this.clinicService.clinicStatsEditor({ _id: clinic._id, targetKey: 'clinicDoctors', modifier: 1 });
        }

        await this.notificationService.createNotification({
            notificationType: NotificationType.DOCTOR_REQUEST,
            notificationGroup: NotificationGroup.CLINIC,
            notificationTitle: approved ? "Request approved" : "Request rejected",
            notificationDesc: `${clinic.clinicName} ${approved ? "approved" : "rejected"} your request`,
            authorId: ownerId,
            receiverId: doctor.memberId,
        });
        return result;
    }

    /** DOCTORS **/

    public async getDoctor(memberId: ObjectId, doctorId: ObjectId): Promise<Doctor> {
        const result = await this.doctorModel
            .aggregate([
                { $match: { _id: doctorId } },
                ...this.activeDoctorStages(),
            ])
            .exec();
        const targetDoctor: Doctor = result[0];
        if (!targetDoctor) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        if (memberId) {
            const viewInput = { memberId: memberId, viewRefId: doctorId, viewGroup: ViewGroup.DOCTOR };
            const newView = await this.viewService.recordView(viewInput);
            if (newView) {
                await this.doctorStatsEditor({ _id: doctorId, targetKey: 'doctorViews', modifier: 1 });
                targetDoctor.doctorViews++;
            }
            const likeInput = { memberId: memberId, likeRefId: doctorId, likeGroup: LikeGroup.DOCTOR };
            targetDoctor.meLiked = await this.likeService.checkLikeExistence(likeInput);
            const followed = await this.followModel.exists({ followerId: memberId, followRefId: doctorId }).exec();
            targetDoctor.meFollowed = followed ? [{ followerId: memberId, followRefId: doctorId, myFollowing: true }] : [];
        }
        return targetDoctor;
    }

    // doctor profile of the given member (created at signup), with its clinic if any
    public async getMyDoctorProfile(memberId: ObjectId): Promise<Doctor> {
        const result = await this.doctorModel
            .aggregate([
                { $match: { memberId: memberId } },
                lookupClinic,
                { $unwind: { path: '$clinicData', preserveNullAndEmptyArrays: true } },
            ])
            .exec();
        if (!result[0]) throw new InternalServerErrorException(Message.NO_DOCTOR_PROFILE);
        return result[0];
    }

    // doctor profile of the given member, with or without a clinic
    public async getDoctorProfileByMember(memberId: ObjectId): Promise<Doctor> {
        const result = await this.doctorModel.findOne({ memberId: memberId }).exec() as unknown as Doctor;
        if (!result) throw new InternalServerErrorException(Message.NO_DOCTOR_PROFILE);
        return result;
    }

    public async getDoctorById(doctorId: ObjectId): Promise<Doctor> {
        const result = await this.doctorModel.findById(doctorId).exec() as unknown as Doctor;
        if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result;
    }

    public async isDoctorMember(doctorId: ObjectId, memberId: ObjectId): Promise<boolean> {
        const exist = await this.doctorModel.exists({ _id: doctorId, memberId: memberId }).exec();
        return !!exist;
    }

    public async getDoctors(memberId: ObjectId, input: DoctorsInquiry): Promise<Doctors> {
        const { clinicId, specialtyList, text } = input.search;
        const match: T = {};
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

        if (clinicId) match.clinicId = shapeIntoMongoObjectId(clinicId);
        if (specialtyList && specialtyList.length) match.specialty = { $in: specialtyList };

        const textMatch: T = {};
        if (text) {
            const regex = shapeIntoSearchRegex(text);
            textMatch['$or'] = [{ 'memberData.memberNick': regex }, { 'memberData.memberFullName': regex }];
        }

        const result = await this.doctorModel
            .aggregate([
                { $match: match },
                ...this.activeDoctorStages(),
                { $match: textMatch },
                { $sort: sort },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            lookupAuthMemberLiked(memberId),
                            lookupAuthMemberFollowed(memberId),
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    // memberData + clinicData; only doctors working in an active clinic with an active member
    private activeDoctorStages(): PipelineStage[] {
        return [
            { $match: { clinicId: { $ne: null } } },
            lookupMember,
            { $unwind: '$memberData' },
            lookupClinic,
            { $unwind: '$clinicData' },
            { $match: { 'memberData.memberStatus': MemberStatus.ACTIVE, 'clinicData.clinicStatus': ClinicStatus.ACTIVE } },
        ];
    }

    // the doctor himself, or the owner of the clinic he works in
    public async updateDoctor(memberId: ObjectId, input: DoctorUpdate): Promise<Doctor> {
        const doctor = await this.getDoctorById(input._id);
        const isSelf = String(doctor.memberId) === String(memberId);
        const isOwner = !!doctor.clinicId && await this.clinicService.isClinicOwner(doctor.clinicId, memberId);
        if (!isSelf && !isOwner) throw new ForbiddenException(Message.NOT_ALLOWED_REQUEST);

        const result = await this.doctorModel
            .findByIdAndUpdate(input._id, input, { new: true })
            .exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    // clinic owner removes a doctor from his clinic; the doctor profile stays
    public async removeDoctor(ownerId: ObjectId, doctorId: ObjectId): Promise<Doctor> {
        const clinic = await this.clinicService.getMyClinic(ownerId);
        return await this.detachDoctor({ _id: doctorId, clinicId: clinic._id });
    }

    public async getFavoriteDoctors(memberId: ObjectId, input: OrdinaryInquiry): Promise<Doctors> {
        return await this.likeService.getFavorites(memberId, input, LikeGroup.DOCTOR, "doctors") as Doctors;
    }

    public async getVisitedDoctors(memberId: ObjectId, input: OrdinaryInquiry): Promise<Doctors> {
        return await this.viewService.getVisited(memberId, input, ViewGroup.DOCTOR, "doctors") as Doctors;
    }

    public async likeTargetDoctor(memberId: ObjectId, likeRefId: ObjectId): Promise<Doctor> {
        const target = await this.getDoctorById(likeRefId);
        if (!target.clinicId) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const input: LikeInput = {
            memberId: memberId,
            likeRefId: likeRefId,
            likeGroup: LikeGroup.DOCTOR
        };

        const modifier: number = await this.likeService.toggleLike(input);
        const result = await this.doctorStatsEditor({
            _id: likeRefId,
            targetKey: "doctorLikes",
            modifier: modifier
        });

        if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
        if (modifier > 0) {
            await this.notificationService.createNotification({
                notificationType: NotificationType.LIKE,
                notificationGroup: NotificationGroup.DOCTOR,
                notificationTitle: "New like",
                notificationDesc: "Your doctor profile got a new like",
                authorId: memberId,
                receiverId: target.memberId,
            });
        }
        return result;
    }

    /** ADMIN **/

    public async removeDoctorByAdmin(doctorId: ObjectId): Promise<Doctor> {
        return await this.detachDoctor({ _id: doctorId, clinicId: { $ne: null } });
    }

    private async detachDoctor(search: T): Promise<Doctor> {
        const hasAppointments = await this.appointmentModel
            .exists({ doctorId: search._id, appointmentStatus: AppointmentStatus.CONFIRMED })
            .exec();
        if (hasAppointments) throw new BadRequestException(Message.DOCTOR_HAS_APPOINTMENTS);

        // returns the doctor before the update, to know which clinic loses him
        const before = await this.doctorModel.findOneAndUpdate(search, { clinicId: null }).exec();
        if (!before) throw new InternalServerErrorException(Message.REMOVE_FAILED);
        await this.clinicService.clinicStatsEditor({ _id: before.clinicId as ObjectId, targetKey: 'clinicDoctors', modifier: -1 });

        return await this.getDoctorById(before._id);
    }

    public async doctorStatsEditor(input: StatisticModifier): Promise<Doctor> {
        const { _id, targetKey, modifier } = input;
        return await this.doctorModel
            .findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
            .exec() as unknown as Doctor;
    }
}
