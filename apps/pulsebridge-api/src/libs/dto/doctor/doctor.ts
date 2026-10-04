import { Field, Int, ObjectType } from "@nestjs/graphql";
import { ObjectId } from "mongoose";
import { DoctorSpecialty } from "../../enums/doctor.enum";
import { Member, TotalCounter } from "../member/member";
import { MeLiked } from "../like/like";
import { Clinic } from "../clinic/clinic";


@ObjectType()
export class Doctor {
    @Field(() => String)
    _id: ObjectId;

    @Field(() => String)
    memberId: ObjectId;

    @Field(() => String)
    clinicId: ObjectId;

    @Field(() => DoctorSpecialty)
    specialty: DoctorSpecialty;

    @Field(() => Int)
    experience: number;

    @Field(() => Int)
    doctorViews: number;

    @Field(() => Int)
    doctorLikes: number;

    @Field(() => Int)
    doctorComments: number;

    @Field(() => Int)
    doctorRank: number;

    @Field(() => Date)
    createdAt: Date;

    @Field(() => Date)
    updatedAt: Date;

    /** from aggregation **/

    @Field(() => [MeLiked], {nullable: true})
    meLiked?: MeLiked[];

    @Field(() => Member, {nullable: true})
    memberData?: Member;

    @Field(() => Clinic, {nullable: true})
    clinicData?: Clinic;
}

@ObjectType()
export class Doctors {
    @Field(() => [Doctor])
    list: Doctor[];

    @Field(() => [TotalCounter], {nullable: true})
    metaCounter: TotalCounter[];
}
