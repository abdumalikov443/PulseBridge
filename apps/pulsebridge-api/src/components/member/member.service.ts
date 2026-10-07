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
import { shapeIntoSearchRegex } from '../../libs/config';
import { Doctor } from '../../libs/dto/doctor/doctor';
import { Clinic } from '../../libs/dto/clinic/clinic';
import { isValidSchedule, withScheduleDefaults } from '../../libs/schedule';

@Injectable()
export class MemberService {

    constructor(
        @InjectModel("Member") private readonly memberModel: Model<Member>,
        @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
        @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>,
        private authService: AuthService,
    ) { }

    // member = account; DOCTOR and CLINIC get their profile (doctors / clinics) in the same signup
    public async signup(input: MemberInput): Promise<Member> {
        const { memberType, doctorProfile, clinicProfile, memberNick, memberPhone } = input;
        if (memberType === MemberType.ADMIN) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
        const memberPassword = await this.authService.hashPassword(input.memberPassword);

        // the very first account of the platform becomes its only ADMIN
        const adminExists = await this.memberModel.exists({ memberType: MemberType.ADMIN }).exec();
        if (!adminExists) {
            if (doctorProfile || clinicProfile) throw new BadRequestException(Message.FIRST_ACCOUNT_ADMIN);
            const admin = await this.createMember({ memberNick, memberPhone, memberPassword, memberType: MemberType.ADMIN });
            if (admin) {
                admin.accessToken = await this.authService.createToken(admin);
                return admin;
            }
            // null: another signup became ADMIN at the same moment, continue as a normal member
        }

        const profileMatches =
            memberType === MemberType.DOCTOR ? !!doctorProfile && !clinicProfile
            : memberType === MemberType.CLINIC ? !!clinicProfile && !doctorProfile
            : !doctorProfile && !clinicProfile;
        if (!profileMatches) throw new BadRequestException(Message.PROFILE_MISMATCH);
        if (clinicProfile && !isValidSchedule(withScheduleDefaults(clinicProfile))) throw new BadRequestException(Message.INVALID_CLINIC_SCHEDULE);

        const result = await this.createMember({ memberNick, memberPhone, memberPassword, memberType }) as Member;

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

    // null when the ADMIN unique index rejects a second ADMIN
    private async createMember(data: T): Promise<Member | null> {
        try {
            return await this.memberModel.create(data);
        } catch (err:any) {
            console.log("Error, Service.model: ", err.message);
            if (err.code === 11000 && err.keyPattern?.memberType) return null;
            throw new BadRequestException(Message.USED_MEMBER_NICK_OR_PHONE);
        }
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
        // members are not followed (doctors / clinics are), so there is no meFollowed here
        return targetMember as unknown as Member;
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
