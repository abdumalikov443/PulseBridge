import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { ObjectId } from "mongoose";
import { ClinicStatus } from "../../enums/clinic.enum";


@InputType()
export class ClinicUpdate {
    @IsNotEmpty()
    @Field(() => String)
    _id: ObjectId;

    @IsOptional()
    @Field(() => ClinicStatus, {nullable: true})
    clinicStatus?: ClinicStatus;

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
}
