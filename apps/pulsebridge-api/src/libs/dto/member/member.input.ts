import { Field, InputType, Int } from "@nestjs/graphql";
import { IsIn, IsNotEmpty, IsOptional, Length, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DoctorProfileInput } from "../doctor/doctor.input";
import { ClinicInput } from "../clinic/clinic.input";
import { MemberStatus, MemberType } from "../../enums/member.enum";
import { availableMemberSorts } from "../../config";
import { Direction } from "../../enums/common.enum";


@InputType()
export class MemberInput {
    @IsNotEmpty()
    @Length(3, 12)
    @Field(() => String)
    memberNick: string;

    @IsNotEmpty()
    @Length(5, 12)
    @Field(() => String)
    memberPassword: string;

    @IsNotEmpty()
    @Field(() => String)
    memberPhone: string;

    // required; ADMIN cannot be chosen, memberStatus always starts ACTIVE
    @IsNotEmpty()
    @IsIn([MemberType.PATIENT, MemberType.DOCTOR, MemberType.CLINIC])
    @Field(() => MemberType)
    memberType: MemberType;

    // required for DOCTOR; the doctor profile is created together with the member
    @IsOptional()
    @ValidateNested()
    @Type(() => DoctorProfileInput)
    @Field(() => DoctorProfileInput, {nullable: true})
    doctorProfile?: DoctorProfileInput;

    // required for CLINIC; the clinic is created together with the member
    @IsOptional()
    @ValidateNested()
    @Type(() => ClinicInput)
    @Field(() => ClinicInput, {nullable: true})
    clinicProfile?: ClinicInput;
}


@InputType()
export class LoginInput {
    @IsNotEmpty()
    @Length(3, 12)
    @Field(() => String)
    memberNick: string;

    @IsNotEmpty()
    @Length(5, 12)
    @Field(() => String)
    memberPassword: string;
}

@InputType()
class MISearch {
    @IsOptional()
    @Field(() => MemberStatus, {nullable: true})
    memberStatus?: MemberStatus;

    @IsOptional()
    @Field(() => MemberType, {nullable: true})
    memberType?: MemberType;

    @IsNotEmpty()
    @Field(() => String, {nullable: true})
    text?: string;
}

@InputType()
export class MembersInquiry {
    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    page: number

    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    limit: number

    @IsOptional()
    @IsIn(availableMemberSorts)
    @Field(() => String, {nullable: true})
    sort?: string;

    @IsOptional()
    @Field(() => Direction, {nullable: true})
    direction?: Direction;

    @IsNotEmpty()
    @Field(() => MISearch)
    search: MISearch;
}