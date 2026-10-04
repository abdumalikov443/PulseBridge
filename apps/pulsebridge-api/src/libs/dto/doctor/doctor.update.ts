import { Field, InputType, Int } from "@nestjs/graphql";
import { IsInt, IsNotEmpty, IsOptional, Min } from "class-validator";
import { ObjectId } from "mongoose";
import { DoctorSpecialty } from "../../enums/doctor.enum";


@InputType()
export class DoctorUpdate {
    @IsNotEmpty()
    @Field(() => String)
    _id: ObjectId;

    @IsOptional()
    @Field(() => DoctorSpecialty, {nullable: true})
    specialty?: DoctorSpecialty;

    @IsOptional()
    @IsInt()
    @Min(0)
    @Field(() => Int, {nullable: true})
    experience?: number;
}
