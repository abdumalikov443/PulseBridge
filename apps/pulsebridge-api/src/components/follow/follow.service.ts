import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, PipelineStage } from 'mongoose';
import { Follow, Follows } from '../../libs/dto/follow/follow';
import { FollowersInquiry, FollowingsInquiry, FollowInput } from '../../libs/dto/follow/follow.input';
import { MemberService } from '../member/member.service';
import { DoctorService } from '../doctor/doctor.service';
import { ClinicService } from '../clinic/clinic.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { FollowGroup } from '../../libs/enums/follow.enum';
import { T } from '../../libs/types/common';
import { lookupAuthMemberFollowed, lookupFollowedClinic, lookupFollowedDoctor, lookupFollowerData } from '../../libs/config';
import { NotificationService } from '../notification/notification.service';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';

@Injectable()
export class FollowService {
    constructor(
        @InjectModel("Follow") private readonly followModel: Model<Follow>,
        private readonly memberService: MemberService,
        private readonly doctorService: DoctorService,
        private readonly clinicService: ClinicService,
        private readonly notificationService: NotificationService,
    ) {}

    // follow a public doctor (works in an active clinic) or an active clinic
    public async subscribe(followerId: ObjectId, input: FollowInput): Promise<Follow> {
        const { followGroup, refId } = input;
        const ownerId = await this.getPublicTargetOwner(followGroup, refId);
        if (String(ownerId) === String(followerId)) throw new BadRequestException(Message.SELF_SUBSCRIPTION_DENIED);

        let result: Follow;
        try {
            result = await this.followModel.create({ followerId: followerId, followGroup: followGroup, followRefId: refId });
        } catch (err: any) {
            console.log("Error, Service.model:", err.message);
            if (err.code === 11000) throw new BadRequestException(Message.ALREADY_FOLLOWING);
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        await this.followStatsEditor(followerId, input, 1);
        await this.notificationService.createNotification({
            notificationType: NotificationType.FOLLOW,
            notificationGroup: followGroup === FollowGroup.DOCTOR ? NotificationGroup.DOCTOR : NotificationGroup.CLINIC,
            notificationTitle: "New follower",
            notificationDesc: `Someone started following your ${followGroup === FollowGroup.DOCTOR ? 'doctor profile' : 'clinic'}`,
            authorId: followerId,
            receiverId: ownerId,
        });
        return result;
    }

    // always allowed, even if the doctor / clinic is no longer public
    public async unsubscribe(followerId: ObjectId, input: FollowInput): Promise<Follow> {
        const result = await this.followModel
            .findOneAndDelete({ followerId: followerId, followGroup: input.followGroup, followRefId: input.refId })
            .exec();
        if (!result) throw new BadRequestException(Message.NOT_FOLLOWING);

        await this.followStatsEditor(followerId, input, -1);
        return result;
    }

    // member who owns the doctor / clinic profile; throws when it is not public
    private async getPublicTargetOwner(followGroup: FollowGroup, refId: ObjectId): Promise<ObjectId> {
        const none = null as unknown as ObjectId;
        if (followGroup === FollowGroup.DOCTOR) return (await this.doctorService.getDoctor(none, refId)).memberId;
        return (await this.clinicService.getClinic(none, refId)).memberId;
    }

    private async followStatsEditor(followerId: ObjectId, input: FollowInput, modifier: number): Promise<void> {
        await this.memberService.memberStatsEditor({ _id: followerId, targetKey: "memberFollowings", modifier: modifier });
        if (input.followGroup === FollowGroup.DOCTOR) {
            await this.doctorService.doctorStatsEditor({ _id: input.refId, targetKey: "doctorFollowers", modifier: modifier });
        } else {
            await this.clinicService.clinicStatsEditor({ _id: input.refId, targetKey: "clinicFollowers", modifier: modifier });
        }
    }

    // doctors and clinics a member follows, with their data
    public async getMemberFollowings(memberId: ObjectId, input: FollowingsInquiry): Promise<Follows> {
        const { page, limit, search } = input;
        return await this.getFollowList({ followerId: search.followerId }, page, limit, [
            lookupAuthMemberFollowed(memberId, "$followRefId"),
            lookupFollowedDoctor,
            { $unwind: { path: '$doctorData', preserveNullAndEmptyArrays: true } },
            lookupFollowedClinic,
            { $unwind: { path: '$clinicData', preserveNullAndEmptyArrays: true } },
        ]);
    }

    // members who follow a doctor / clinic
    public async getFollowers(input: FollowersInquiry): Promise<Follows> {
        const { page, limit, search } = input;
        return await this.getFollowList({ followGroup: search.followGroup, followRefId: search.refId }, page, limit, [
            lookupFollowerData,
            { $unwind: '$followerData' },
        ]);
    }

    private async getFollowList(match: T, page: number, limit: number, lookups: PipelineStage.FacetPipelineStage[]): Promise<Follows> {
        const result = await this.followModel.aggregate([
            { $match: match },
            { $sort: { createdAt: Direction.DESC } },
            {
                $facet: {
                    list: [{ $skip: (page - 1) * limit }, { $limit: limit }, ...lookups],
                    metaCounter: [{ $count: 'total' }],
                },
            },
        ]).exec();
        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }
}
