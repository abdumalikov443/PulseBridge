import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ObjectId } from "mongoose";
import { Clinic, Clinics } from "../../libs/dto/clinic/clinic";
import { AllClinicsInquiry, ClinicInput, ClinicsInquiry } from "../../libs/dto/clinic/clinic.input";
import { ClinicUpdate } from "../../libs/dto/clinic/clinic.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { Direction, Message } from "../../libs/enums/common.enum";
import { ClinicStatus } from "../../libs/enums/clinic.enum";
import { ViewGroup } from "../../libs/enums/view.enum";
import { LikeGroup } from "../../libs/enums/like.enum";
import { StatisticModifier, T } from "../../libs/types/common";
import { lookupAuthMemberLiked, lookupMember, shapeIntoSearchRegex } from "../../libs/config";
import { MemberService } from "../member/member.service";
import { ViewService } from "../view/view.service";
import { LikeService } from "../like/like.service";
import { LikeInput } from "../../libs/dto/like/like.input";
import { NotificationService } from "../notification/notification.service";
import { NotificationGroup, NotificationType } from "../../libs/enums/notification.enum";

@Injectable()
export class ClinicService {
    constructor (
        @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>,
        private memberService: MemberService,
        private viewService: ViewService,
        private likeService: LikeService,
        private notificationService: NotificationService
    ) {}

    public async createClinic(input: ClinicInput): Promise<Clinic> {
        const exist = await this.clinicModel.findOne({ memberId: input.memberId }).exec();
        if (exist) throw new BadRequestException(Message.CLINIC_ALREADY_EXISTS);

        try {
            return await this.clinicModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }
    }

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

        const result = await this.clinicModel
            .findOneAndUpdate(search, input, { new: true })
            .exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    public async getClinics(memberId: ObjectId, input: ClinicsInquiry): Promise<Clinics> {
        const { clinicType, text } = input.search;
        const match: T = { clinicStatus: ClinicStatus.ACTIVE };
        if (clinicType) match.clinicType = clinicType;
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

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
            });
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
        const result = await this.clinicModel
            .findOneAndUpdate({ _id: input._id }, input, { new: true })
            .exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    public async removeClinicByAdmin(clinicId: ObjectId): Promise<Clinic> {
        const search: T = {
            _id: clinicId,
            clinicStatus: ClinicStatus.DELETE
        };
        const result = await this.clinicModel.findOneAndDelete(search).exec();
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

        return result;
    }

    public async clinicStatsEditor(input: StatisticModifier): Promise<Clinic> {
        const { _id, targetKey, modifier } = input;
        return await this.clinicModel
            .findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
            .exec() as unknown as Clinic;
    }
}
