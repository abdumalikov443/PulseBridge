import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId } from "mongoose";
import { Clinic, Clinics } from "../../libs/dto/clinic/clinic";
import { AllClinicsInquiry, ClinicsInquiry } from "../../libs/dto/clinic/clinic.input";
import { ClinicUpdate } from "../../libs/dto/clinic/clinic.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { Direction, Message } from "../../libs/enums/common.enum";
import { ClinicStatus } from "../../libs/enums/clinic.enum";
import { ViewGroup } from "../../libs/enums/view.enum";
import { LikeGroup } from "../../libs/enums/like.enum";
import { StatisticModifier, T } from "../../libs/types/common";
import { lookupAuthMemberFollowed, lookupAuthMemberLiked, lookupMember, shapeIntoSearchRegex } from "../../libs/config";
import { MemberService } from "../member/member.service";
import { ViewService } from "../view/view.service";
import { LikeService } from "../like/like.service";
import { LikeInput } from "../../libs/dto/like/like.input";
import { NotificationService } from "../notification/notification.service";
import { NotificationGroup, NotificationType } from "../../libs/enums/notification.enum";
import { Doctor } from "../../libs/dto/doctor/doctor";
import { ClinicJoinRequest } from "../../libs/dto/doctor/join-request";
import { JoinRequestStatus } from "../../libs/enums/doctor.enum";
import { AppointmentStatus } from "../../libs/enums/appointment.enum";
import { isValidSchedule, withScheduleDefaults } from "../../libs/schedule";
import { CLINIC_RANK_KEYS, clinicRankExpr, statsWithRankPipeline } from "../../libs/rank";

@Injectable()
export class ClinicService {
    constructor (
        @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>,
        @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
        @InjectModel("ClinicJoinRequest") private readonly requestModel: Model<ClinicJoinRequest>,
        @InjectModel("Appointment") private readonly appointmentModel: Model<any>,
        @InjectModel("Follow") private readonly followModel: Model<any>,
        private memberService: MemberService,
        private viewService: ViewService,
        private likeService: LikeService,
        private notificationService: NotificationService
    ) {}

    public async getClinic(memberId: ObjectId, clinicId: ObjectId): Promise<Clinic> {
        const search: T = {
            _id: clinicId,
            clinicStatus: ClinicStatus.ACTIVE
        };
        //@ts-ignore
        const targetClinic: Clinic = await this.clinicModel.findOne(search).lean().exec();
        if (!targetClinic) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        if (memberId) {
            const viewInput = { memberId: memberId, viewRefId: clinicId, viewGroup: ViewGroup.CLINIC };
            const newView = await this.viewService.recordView(viewInput);
            if (newView) {
                await this.clinicStatsEditor({ _id: clinicId, targetKey: 'clinicViews', modifier: 1 });
                targetClinic.clinicViews++;
            }
            const likeInput = { memberId: memberId, likeRefId: clinicId, likeGroup: LikeGroup.CLINIC };
            targetClinic.meLiked = await this.likeService.checkLikeExistence(likeInput);
            const followed = await this.followModel.exists({ followerId: memberId, followRefId: clinicId }).exec();
            targetClinic.meFollowed = followed ? [{ followerId: memberId, followRefId: clinicId, myFollowing: true }] : [];
        }
        // @ts-ignore
        targetClinic.memberData = await this.memberService.getMember(null, targetClinic.memberId);
        return targetClinic;
    }

    // clinic owned by the given CLINIC member (any status except DELETE)
    public async getMyClinic(memberId: ObjectId): Promise<Clinic> {
        const result = await this.clinicModel
            .findOne({ memberId: memberId, clinicStatus: { $ne: ClinicStatus.DELETE } })
            .exec() as unknown as Clinic;
        if (!result) throw new InternalServerErrorException(Message.NO_CLINIC);
        return result;
    }

    public async isClinicOwner(clinicId: ObjectId, memberId: ObjectId): Promise<boolean> {
        const exist = await this.clinicModel.exists({ _id: clinicId, memberId: memberId }).exec();
        return !!exist;
    }

    public async updateClinic(memberId: ObjectId, input: ClinicUpdate): Promise<Clinic> {
        const search: T = {
            _id: input._id,
            memberId: memberId,
            clinicStatus: { $ne: ClinicStatus.DELETE }
        };
        return await this.saveClinicUpdate(search, input);
    }

    // DELETE: blocked while appointments are confirmed; afterwards the clinic's doctors are released
    private async saveClinicUpdate(search: T, input: ClinicUpdate): Promise<Clinic> {
        const deleting = input.clinicStatus === ClinicStatus.DELETE;
        const scheduleKeys = ['clinicOpenTime', 'clinicCloseTime', 'clinicBreakStart', 'clinicBreakEnd', 'clinicOffDays'];
        const changesSchedule = scheduleKeys.some((key) => input[key] !== undefined);
        if (deleting || changesSchedule) {
            const target = await this.clinicModel.findOne(search).lean().exec();
            if (!target) throw new InternalServerErrorException(Message.UPDATE_FAILED);
            if (deleting) await this.checkNoConfirmedAppointments(target._id);
            // the new values together with the current schedule must still be valid
            const schedule = { ...withScheduleDefaults(target as T), ...Object.fromEntries(scheduleKeys.filter((key) => input[key] !== undefined).map((key) => [key, input[key]])) };
            if (changesSchedule && !isValidSchedule(schedule)) throw new BadRequestException(Message.INVALID_CLINIC_SCHEDULE);
        }

        const result = await this.clinicModel
            .findOneAndUpdate(search, input, { new: true })
            .exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

        if (deleting) await this.releaseClinic(result._id);
        return result;
    }

    private async checkNoConfirmedAppointments(clinicId: ObjectId): Promise<void> {
        const confirmed = await this.appointmentModel
            .exists({ clinicId: clinicId, appointmentStatus: AppointmentStatus.CONFIRMED })
            .exec();
        if (confirmed) throw new BadRequestException(Message.CLINIC_HAS_APPOINTMENTS);
    }

    // doctors leave the clinic (profiles stay) and its pending join requests are rejected
    private async releaseClinic(clinicId: ObjectId): Promise<void> {
        await this.doctorModel.updateMany({ clinicId: clinicId }, { clinicId: null }).exec();
        await this.requestModel
            .updateMany({ clinicId: clinicId, requestStatus: JoinRequestStatus.PENDING }, { requestStatus: JoinRequestStatus.REJECTED })
            .exec();
        await this.clinicModel.updateOne({ _id: clinicId }, { clinicDoctors: 0 }).exec();
    }

    public async getClinics(memberId: ObjectId, input: ClinicsInquiry): Promise<Clinics> {
        const { clinicType, text } = input.search;
        const match: T = { clinicStatus: ClinicStatus.ACTIVE };
        if (clinicType) match.clinicType = clinicType;
        // equal ranks / likes: newest first, stable pages
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };
        if (!('createdAt' in sort)) sort.createdAt = Direction.DESC;
        sort._id = Direction.DESC;

        if (text) match.clinicName = { $regex: shapeIntoSearchRegex(text) };

        const result = await this.clinicModel
            .aggregate([
                {$match: match},
                {$sort: sort},
                {
                    $facet: {
                        list: [
                            {$skip: (input.page - 1) * input.limit},
                            {$limit: input.limit},
                            lookupAuthMemberLiked(memberId),
                            lookupAuthMemberFollowed(memberId),
                            lookupMember,
                            { $unwind: '$memberData'},
                        ],
                        metaCounter: [{$count: 'total'}],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        return result[0];
    }

    public async getFavoriteClinics(memberId: ObjectId, input: OrdinaryInquiry): Promise<Clinics> {
        return await this.likeService.getFavorites(memberId, input, LikeGroup.CLINIC, "clinics") as Clinics;
    }

    public async getVisitedClinics(memberId: ObjectId, input: OrdinaryInquiry): Promise<Clinics> {
        return await this.viewService.getVisited(memberId, input, ViewGroup.CLINIC, "clinics") as Clinics;
    }

    public async likeTargetClinic(memberId: ObjectId, likeRefId: ObjectId): Promise<Clinic> {
        const target: Clinic = await this.clinicModel.findOne({_id: likeRefId, clinicStatus: ClinicStatus.ACTIVE}).exec() as unknown as Clinic;
        if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const input: LikeInput = {
            memberId: memberId,
            likeRefId: likeRefId,
            likeGroup: LikeGroup.CLINIC
        };

        const modifier: number = await this.likeService.toggleLike(input);
        const result = await this.clinicStatsEditor({
            _id: likeRefId,
            targetKey: "clinicLikes",
            modifier: modifier
        });

        if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
        if (modifier > 0) {
            await this.notificationService.createNotification({
                notificationType: NotificationType.LIKE,
                notificationGroup: NotificationGroup.CLINIC,
                notificationTitle: "New like",
                notificationDesc: `Your clinic ${target.clinicName} got a new like`,
                authorId: memberId,
                receiverId: target.memberId,
                notificationRefId: likeRefId,
            });
        } else {
            await this.notificationService.removeRefNotification(NotificationType.LIKE, memberId, likeRefId);
        }
        return result;
    }

    /** ADMIN **/

    public async getAllClinicsByAdmin(input: AllClinicsInquiry): Promise<Clinics> {
        const { clinicStatus, clinicType, text } = input.search;
        const match: T = {};
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

        if (clinicStatus) match.clinicStatus = clinicStatus;
        if (clinicType) match.clinicType = clinicType;
        if (text) match.clinicName = { $regex: shapeIntoSearchRegex(text) };

        const result = await this.clinicModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            lookupMember,
                            { $unwind: '$memberData' },
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        return result[0];
    }

    public async updateClinicByAdmin(input: ClinicUpdate): Promise<Clinic> {
        return await this.saveClinicUpdate({ _id: input._id }, input);
    }

    public async removeClinicByAdmin(clinicId: ObjectId): Promise<Clinic> {
        const search: T = {
            _id: clinicId,
            clinicStatus: ClinicStatus.DELETE
        };
        const target = await this.clinicModel.findOne(search).exec();
        if (!target) throw new InternalServerErrorException(Message.REMOVE_FAILED);
        await this.checkNoConfirmedAppointments(target._id);
        // already done when the clinic became DELETE; repeated in case of older data
        await this.releaseClinic(target._id);

        const result = await this.clinicModel.findOneAndDelete(search).exec();
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
        return result;
    }

    // likes / followers / comments / views also recalculate clinicRank in the same update
    public async clinicStatsEditor(input: StatisticModifier): Promise<Clinic> {
        const { _id, targetKey, modifier } = input;
        const pipeline = statsWithRankPipeline(targetKey, modifier, 'clinicRank', CLINIC_RANK_KEYS, clinicRankExpr);
        return await this.clinicModel
            .findByIdAndUpdate(_id, pipeline, { new: true })
            .exec() as unknown as Clinic;
    }
}
