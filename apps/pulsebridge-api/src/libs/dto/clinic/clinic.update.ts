import { Field, InputType } from "@nestjs/graphql";
import { IsIn, IsNotEmpty, IsOptional, Length, Matches } from "class-validator";
import { ObjectId } from "mongoose";
import { ClinicStatus, ClinicType, WeekDay } from "../../enums/clinic.enum";
import { HALF_HOUR_TIME } from "../../schedule";


@InputType()
export class ClinicUpdate {
    @IsNotEmpty()
    @Field(() => String)
    _id: ObjectId;

    @IsOptional()
    @Field(() => ClinicStatus, {nullable: true})
    clinicStatus?: ClinicStatus;

    @IsOptional()
    @Field(() => ClinicType, {nullable: true})
    clinicType?: ClinicType;

    @IsOptional()
    @Length(3, 100)
    @Field(() => String, {nullable: true})
    clinicName?: string;

    @IsOptional()
    @Length(3, 100)
    @Field(() => String, {nullable: true})
    clinicAddress?: string;

    @IsOptional()
    @Length(5, 500)
    @Field(() => String, {nullable: true})
    clinicDesc?: string;

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
}
