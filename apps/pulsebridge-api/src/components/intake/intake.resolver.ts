import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { IntakeService } from './intake.service';
import { IntakeChatResult, IntakeSession } from '../../libs/dto/intake/intake';
import { IntakeChatInput } from '../../libs/dto/intake/intake.input';
import { Doctors } from '../../libs/dto/doctor/doctor';
import { WithoutGuard } from '../auth/guards/without.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { T } from '../../libs/types/common';

// AI patient intake: messages are health data, so they are never logged
@Resolver()
export class IntakeResolver {
    constructor(private readonly intakeService: IntakeService) {}

    // guests too (no token needed)
    @UseGuards(WithoutGuard)
    @Mutation(() => IntakeChatResult)
    public async intakeChat(
        @Args('input') input: IntakeChatInput,
        @AuthMember('_id') memberId: ObjectId,
        @Context('req') req: T
    ): Promise<IntakeChatResult> {
        console.log("Mutation: intakeChat");
        const ip = String(req?.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim() || req?.ip || 'unknown';
        return await this.intakeService.chat(memberId ?? null, ip, input);
    }

    // after login / signup: attach the guest conversation to the patient
    @Roles(MemberType.PATIENT)
    @UseGuards(RolesGuard)
    @Mutation(() => IntakeSession)
    public async claimIntakeSession(
        @Args('sessionKey') sessionKey: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<IntakeSession> {
        console.log("Mutation: claimIntakeSession");
        return await this.intakeService.claimSession(memberId, sessionKey);
    }

    @Roles(MemberType.PATIENT)
    @UseGuards(RolesGuard)
    @Query(() => IntakeSession)
    public async getIntakeSession(
        @Args('sessionKey') sessionKey: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<IntakeSession> {
        console.log("Query: getIntakeSession");
        return await this.intakeService.getSession(memberId, sessionKey);
    }

    @Roles(MemberType.PATIENT)
    @UseGuards(RolesGuard)
    @Query(() => Doctors)
    public async getIntakeRecommendations(
        @Args('sessionKey') sessionKey: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctors> {
        console.log("Query: getIntakeRecommendations");
        return await this.intakeService.getRecommendations(memberId, sessionKey);
    }
}
