import { Field, InputType, Int } from "@nestjs/graphql";
import { IsIn, IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";
import { ObjectId } from "mongoose";
import { DoctorSpecialty, JoinRequestStatus } from "../../enums/doctor.enum";
import { Direction } from "../../enums/common.enum";
import { availableDoctorSorts } from "../../config";


// doctor profile sent with a DOCTOR signup
@InputType()
export class DoctorProfileInput {
    @IsNotEmpty()
    @Field(() => DoctorSpecialty)
    specialty: DoctorSpecialty;

    @IsNotEmpty()
    @IsInt()
    @Min(0)
    @Field(() => Int)
    experience: number;
}


// clinic owner approves or rejects a join request
@InputType()
export class JoinRequestUpdate {
    @IsNotEmpty()
    @Field(() => String)
    _id: ObjectId;

    @IsNotEmpty()
    @IsIn([JoinRequestStatus.APPROVED, JoinRequestStatus.REJECTED])
    @Field(() => JoinRequestStatus)
    requestStatus: JoinRequestStatus;
}


@InputType()
class DOSearch {
    @IsOptional()
    @Field(() => String, {nullable: true})
    clinicId?: ObjectId;

    @IsOptional()
    @Field(() => [DoctorSpecialty], {nullable: true})
    specialtyList?: DoctorSpecialty[];

    @IsOptional()
    @Field(() => String, {nullable: true})
    text?: string;
}

@InputType()
export class DoctorsInquiry {
    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    page: number;

    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    limit: number;

    @IsOptional()
    @IsIn(availableDoctorSorts)
    @Field(() => String, {nullable: true})
    sort?: string;

    @IsOptional()
    @Field(() => Direction, {nullable: true})
    direction?: Direction;

    @IsNotEmpty()
    @Field(() => DOSearch)
    search: DOSearch;
}
