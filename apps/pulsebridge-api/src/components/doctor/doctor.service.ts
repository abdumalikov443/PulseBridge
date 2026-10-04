import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId, PipelineStage } from "mongoose";
import { Doctor, Doctors } from "../../libs/dto/doctor/doctor";
import { DoctorInput, DoctorsInquiry } from "../../libs/dto/doctor/doctor.input";
import { DoctorUpdate } from "../../libs/dto/doctor/doctor.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { LikeInput } from "../../libs/dto/like/like.input";
import { Direction, Message } from "../../libs/enums/common.enum";
import { MemberStatus, MemberType } from "../../libs/enums/member.enum";
import { ClinicStatus } from "../../libs/enums/clinic.enum";
import { AppointmentStatus } from "../../libs/enums/appointment.enum";
import { ViewGroup } from "../../libs/enums/view.enum";
import { LikeGroup } from "../../libs/enums/like.enum";
import { StatisticModifier, T } from "../../libs/types/common";
import { lookupAuthMemberLiked, lookupClinic, lookupMember, shapeIntoMongoObjectId, shapeIntoSearchRegex } from "../../libs/config";
import { MemberService } from "../member/member.service";
import { ClinicService } from "../clinic/clinic.service";
import { ViewService } from "../view/view.service";
import { LikeService } from "../like/like.service";
import { NotificationService } from "../notification/notification.service";
import { NotificationGroup, NotificationType } from "../../libs/enums/notification.enum";

@Injectable()
export class DoctorService {
    constructor (
        @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
        @InjectModel("Appointment") private readonly appointmentModel: Model<any>,
        private memberService: MemberService,
        private clinicService: ClinicService,
        private viewService: ViewService,
        private likeService: LikeService,
        private notificationService: NotificationService
    ) {}

    // clinic owner adds a DOCTOR member (or himself) to his clinic
    public async createDoctor(ownerId: ObjectId, input: DoctorInput): Promise<Doctor> {
        const clinic = await this.clinicService.getMyClinic(ownerId);
        const target = await this.memberService.getMember(null as unknown as ObjectId, input.memberId);

        const isOwner = String(target._id) === String(ownerId);
        if (target.memberStatus !== MemberStatus.ACTIVE || (target.memberType !== MemberType.DOCTOR && !isOwner)) {
            throw new BadRequestException(Message.ONLY_DOCTOR_MEMBERS);
        }

        const exist = await this.doctorModel.findOne({ memberId: input.memberId }).exec();
        if (exist) throw new BadRequestException(Message.DOCTOR_ALREADY_EXISTS);

        input.clinicId = clinic._id;
        try {
            return await this.doctorModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }
    }

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
        }
        return targetDoctor;
    }

    // doctor record of the given member
    public async getMyDoctorProfile(memberId: ObjectId): Promise<Doctor> {
        const result = await this.doctorModel.findOne({ memberId: memberId }).exec() as unknown as Doctor;
        if (!result) throw new InternalServerErrorException(Message.NOT_DOCTOR);
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
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    // memberData + clinicData, only active doctors in active clinics
    private activeDoctorStages(): PipelineStage[] {
        return [
            lookupMember,
            { $unwind: '$memberData' },
            lookupClinic,
            { $unwind: '$clinicData' },
            { $match: { 'memberData.memberStatus': MemberStatus.ACTIVE, 'clinicData.clinicStatus': ClinicStatus.ACTIVE } },
        ];
    }

    // the doctor himself or his clinic owner
    public async updateDoctor(memberId: ObjectId, input: DoctorUpdate): Promise<Doctor> {
        const doctor = await this.getDoctorById(input._id);
        const isSelf = String(doctor.memberId) === String(memberId);
        if (!isSelf && !(await this.clinicService.isClinicOwner(doctor.clinicId, memberId))) {
            throw new ForbiddenException(Message.NOT_ALLOWED_REQUEST);
        }

        const result = await this.doctorModel
            .findByIdAndUpdate(input._id, input, { new: true })
            .exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    // clinic owner removes a doctor from his clinic
    public async removeDoctor(ownerId: ObjectId, doctorId: ObjectId): Promise<Doctor> {
        const clinic = await this.clinicService.getMyClinic(ownerId);
        return await this.deleteDoctor({ _id: doctorId, clinicId: clinic._id });
    }

    public async getFavoriteDoctors(memberId: ObjectId, input: OrdinaryInquiry): Promise<Doctors> {
        return await this.likeService.getFavorites(memberId, input, LikeGroup.DOCTOR, "doctors") as Doctors;
    }

    public async getVisitedDoctors(memberId: ObjectId, input: OrdinaryInquiry): Promise<Doctors> {
        return await this.viewService.getVisited(memberId, input, ViewGroup.DOCTOR, "doctors") as Doctors;
    }

    public async likeTargetDoctor(memberId: ObjectId, likeRefId: ObjectId): Promise<Doctor> {
        const target = await this.getDoctorById(likeRefId);

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
        return await this.deleteDoctor({ _id: doctorId });
    }

    private async deleteDoctor(search: T): Promise<Doctor> {
        const hasAppointments = await this.appointmentModel
            .exists({ doctorId: search._id, appointmentStatus: AppointmentStatus.CONFIRMED })
            .exec();
        if (hasAppointments) throw new BadRequestException(Message.DOCTOR_HAS_APPOINTMENTS);

        const result = await this.doctorModel.findOneAndDelete(search).exec();
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
        return result;
    }

    public async doctorStatsEditor(input: StatisticModifier): Promise<Doctor> {
        const { _id, targetKey, modifier } = input;
        return await this.doctorModel
            .findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
            .exec() as unknown as Doctor;
    }
}
