import { Field, InputType, Int } from "@nestjs/graphql";
import { IsIn, IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";
import { ObjectId } from "mongoose";
import { DoctorSpecialty } from "../../enums/doctor.enum";
import { Direction } from "../../enums/common.enum";
import { availableDoctorSorts } from "../../config";


@InputType()
export class DoctorInput {
    // DOCTOR member to add (or the clinic owner himself)
    @IsNotEmpty()
    @Field(() => String)
    memberId: ObjectId;

    @IsNotEmpty()
    @Field(() => DoctorSpecialty)
    specialty: DoctorSpecialty;

    @IsNotEmpty()
    @IsInt()
    @Min(0)
    @Field(() => Int)
    experience: number;

    clinicId?: ObjectId;
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
