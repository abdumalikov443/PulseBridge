import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Member, Members } from '../../libs/dto/member/member';
import { LoginInput, MemberInput, MembersInquiry } from '../../libs/dto/member/member.input';
import { MemberStatus, MemberType } from '../../libs/enums/member.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { AuthService } from '../auth/auth.service';
import { MemberUpdate } from '../../libs/dto/member/member.update';
import { StatisticModifier, T } from '../../libs/types/common';
import { Follower, Following, MeFollowed } from '../../libs/dto/follow/follow';
import { shapeIntoSearchRegex } from '../../libs/config';
import { Doctor } from '../../libs/dto/doctor/doctor';
import { Clinic } from '../../libs/dto/clinic/clinic';

@Injectable()
export class MemberService {

    constructor(
        @InjectModel("Member") private readonly memberModel: Model<Member>,
        @InjectModel("Follow") private readonly followModel: Model<Follower | Following>,
        @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
        @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>,
        private authService: AuthService,
    ) { }

    // member = account; DOCTOR and CLINIC get their profile (doctors / clinics) in the same signup
    public async signup(input: MemberInput): Promise<Member> {
        const { memberType, doctorProfile, clinicProfile } = input;
        if (memberType === MemberType.ADMIN) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
        const profileMatches =
            memberType === MemberType.DOCTOR ? !!doctorProfile && !clinicProfile
            : memberType === MemberType.CLINIC ? !!clinicProfile && !doctorProfile
            : !doctorProfile && !clinicProfile;
        if (!profileMatches) throw new BadRequestException(Message.PROFILE_MISMATCH);

        const { memberNick, memberPhone } = input;
        const memberPassword = await this.authService.hashPassword(input.memberPassword);
        let result: Member;
        try {
            result = await this.memberModel.create({ memberNick, memberPhone, memberPassword, memberType });
        } catch (err:any) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
        }

        try {
            if (doctorProfile) await this.doctorModel.create({ ...doctorProfile, memberId: result._id });
            if (clinicProfile) await this.clinicModel.create({ ...clinicProfile, memberId: result._id });
        } catch (err:any) {
            // no account without its profile
            console.log("Error, Service.model: ", err.message);
            await this.memberModel.deleteOne({ _id: result._id }).exec();
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        result.accessToken = await this.authService.createToken(result);
        return result;
    }

    public async login(input: LoginInput): Promise<Member> {
        const { memberNick, memberPassword } = input;
        const response: Member | null = await this.memberModel
            .findOne({ memberNick: memberNick })
            .select("+memberPassword")
            .exec();

        if (!response || response.memberStatus === MemberStatus.DELETE) {
            throw new InternalServerErrorException(Message.NO_MEMBER_NICK);
        } else if (response.memberStatus === MemberStatus.BLOCK) {
            throw new InternalServerErrorException(Message.BLOCKED_USER);
        }

        // TODO Compare Passwords
        const isMatch = await this.authService.comparePasswords(input.memberPassword, response.memberPassword as string);
        if (!isMatch) throw new InternalServerErrorException(Message.WRONG_PASSWORD);
        response.accessToken = await this.authService.createToken(response);

        return response;
    }

    public async updateMember(memberId: ObjectId, input: MemberUpdate): Promise<Member> {
        const result: Member | null = await this.memberModel.findOneAndUpdate(
            { _id: memberId, memberStatus: MemberStatus.ACTIVE }, input, { new: true }
        ).exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        result.accessToken = await this.authService.createToken(result);
        return result;
    }

    public async getMember(memberId: ObjectId, targetId: ObjectId): Promise<Member> {
        const search: T = {
            _id: targetId,
            memberStatus: {
                $in: [MemberStatus.ACTIVE, MemberStatus.BLOCK]
            },
        };
        const targetMember = await this.memberModel.findOne(search).lean().exec();
        if (!targetMember) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        if (memberId) {
            //@ts-ignore
            targetMember.meFollowed = await this.checkSubscription(memberId, targetId);
        }

        return targetMember;
    }
    
    private async checkSubscription(followerId: ObjectId, followingId: ObjectId): Promise<MeFollowed[]> {
        const result = await this.followModel.findOne({ followingId: followingId, followerId: followerId}).exec();
        return result ? [{followerId: followerId, followingId: followingId, myFollowing: true}] : [];
    }

    public async getAllMembersByAdmin(input: MembersInquiry): Promise<Members> {
        const { memberStatus, memberType, text } = input.search;
        const match: T = {};
        const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

        if(memberStatus) match.memberStatus = memberStatus;
        if(memberType) match.memberType = memberType;
        if (text) match.memberNick = { $regex: shapeIntoSearchRegex(text) };
        console.log("match: ", match);

        const result = await this.memberModel.aggregate([
            { $match: match },
            { $sort: sort },
            {
                $facet: {
                    list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
                    metaCounter: [{ $count: 'total' }]
                }
            }
        ]).exec();

        if(!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND)
        return result[0];
    }

    public async updateMemberByAdmin(input: MemberUpdate): Promise<Member> {
        const result: Member | null = await this.memberModel.findOneAndUpdate({_id: input._id}, input, {new: true}).exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED)
        return result;
    }

    public async memberStatsEditor(input: StatisticModifier): Promise<Member> {
        const { _id, targetKey, modifier } = input;
        return await this.memberModel
            .findByIdAndUpdate(_id, {$inc: { [targetKey]: modifier }}, {new: true})
            .exec() as unknown as Member;
    }

}
