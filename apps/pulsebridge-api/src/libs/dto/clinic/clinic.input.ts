import { Field, InputType, Int } from "@nestjs/graphql";
import { IsIn, IsNotEmpty, IsOptional, Length, Matches, Min } from "class-validator";
import { ClinicStatus, ClinicType, WeekDay } from "../../enums/clinic.enum";
import { HALF_HOUR_TIME } from "../../schedule";
import { ObjectId } from "mongoose";
import { Direction } from "../../enums/common.enum";
import { availableClinicSorts } from "../../config";


// clinic profile sent with a CLINIC signup
@InputType()
export class ClinicInput {
    @IsNotEmpty()
    @Field(() => ClinicType)
    clinicType: ClinicType;

    @IsNotEmpty()
    @Length(3, 100)
    @Field(() => String)
    clinicName: string;

    @IsNotEmpty()
    @Length(3, 100)
    @Field(() => String)
    clinicAddress: string;

    @IsNotEmpty()
    @Length(5, 500)
    @Field(() => String)
    clinicDesc: string;

    @IsOptional()
    @Field(() => String, {nullable: true})
    clinicImage?: string;

    // working hours: half hours "HH:mm", e.g. 09:00-18:00, break 13:00-14:00
    @IsOptional()
    @Matches(HALF_HOUR_TIME, { message: 'use HH:00 or HH:30' })
    @Field(() => String, {nullable: true})
    clinicOpenTime?: string;

    @IsOptional()
    @Matches(HALF_HOUR_TIME, { message: 'use HH:00 or HH:30' })
    @Field(() => String, {nullable: true})
    clinicCloseTime?: string;

    @IsOptional()
    @Matches(HALF_HOUR_TIME, { message: 'use HH:00 or HH:30' })
    @Field(() => String, {nullable: true})
    clinicBreakStart?: string;

    @IsOptional()
    @Matches(HALF_HOUR_TIME, { message: 'use HH:00 or HH:30' })
    @Field(() => String, {nullable: true})
    clinicBreakEnd?: string;

    @IsOptional()
    @IsIn(Object.values(WeekDay), { each: true })
    @Field(() => [WeekDay], {nullable: true})
    clinicOffDays?: WeekDay[];

    memberId?: ObjectId;
}


@InputType()
class CLISearch {
    @IsOptional()
    @Field(() => ClinicType, {nullable: true})
    clinicType?: ClinicType;

    @IsOptional()
    @Field(() => String, {nullable: true})
    text?: string;
}

@InputType()
export class ClinicsInquiry {
    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    page: number;

    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    limit: number;

    @IsOptional()
    @IsIn(availableClinicSorts)
    @Field(() => String, {nullable: true})
    sort?: string;

    @IsOptional()
    @Field(() => Direction, {nullable: true})
    direction?: Direction;

    @IsNotEmpty()
    @Field(() => CLISearch)
    search: CLISearch;
}


@InputType()
class ACLISearch {
    @IsOptional()
    @Field(() => ClinicType, {nullable: true})
    clinicType?: ClinicType;

    @IsOptional()
    @Field(() => ClinicStatus, {nullable: true})
    clinicStatus?: ClinicStatus;

    @IsOptional()
    @Field(() => String, {nullable: true})
    text?: string;
}

@InputType()
export class AllClinicsInquiry {
    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    page: number;

    @IsNotEmpty()
    @Min(1)
    @Field(() => Int)
    limit: number;

    @IsOptional()
    @IsIn(availableClinicSorts)
    @Field(() => String, {nullable: true})
    sort?: string;

    @IsOptional()
    @Field(() => Direction, {nullable: true})
    direction?: Direction;

    @IsNotEmpty()
    @Field(() => ACLISearch)
    search: ACLISearch;
}
