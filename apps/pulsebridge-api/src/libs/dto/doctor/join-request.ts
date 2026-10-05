import { Field, ObjectType } from "@nestjs/graphql";
import { ObjectId } from "mongoose";
import { JoinRequestStatus } from "../../enums/doctor.enum";
import { TotalCounter } from "../member/member";
import { Doctor } from "./doctor";
import { Clinic } from "../clinic/clinic";


@ObjectType()
export class ClinicJoinRequest {
    @Field(() => String)
    _id: ObjectId;

    @Field(() => String)
    doctorId: ObjectId;

    @Field(() => String)
    clinicId: ObjectId;

    @Field(() => JoinRequestStatus)
    requestStatus: JoinRequestStatus;

    @Field(() => Date)
    createdAt: Date;

    @Field(() => Date)
    updatedAt: Date;

    /** from aggregation **/

    // doctor with its memberData (for the clinic owner)
    @Field(() => Doctor, {nullable: true})
    doctorData?: Doctor;

    // requested clinic (for the doctor)
    @Field(() => Clinic, {nullable: true})
    clinicData?: Clinic;
}

@ObjectType()
export class ClinicJoinRequests {
    @Field(() => [ClinicJoinRequest])
    list: ClinicJoinRequest[];

    @Field(() => [TotalCounter], {nullable: true})
    metaCounter: TotalCounter[];
}
