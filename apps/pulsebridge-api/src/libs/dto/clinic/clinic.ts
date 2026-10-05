import { Field, Int, ObjectType } from "@nestjs/graphql";
import { ObjectId } from "mongoose";
import { ClinicStatus, ClinicType } from "../../enums/clinic.enum";
import { Member, TotalCounter } from "../member/member";
import { MeLiked } from "../like/like";


@ObjectType()
export class Clinic {
    @Field(() => String)
    _id: ObjectId;

    @Field(() => ClinicStatus)
    clinicStatus: ClinicStatus;

    @Field(() => ClinicType)
    clinicType: ClinicType;

    @Field(() => String)
    clinicName: string;

    @Field(() => String)
    clinicAddress: string;

    @Field(() => String)
    clinicDesc: string;

    @Field(() => String, {nullable: true})
    clinicImage?: string;

    @Field(() => Int)
    clinicViews: number;

    @Field(() => Int)
    clinicLikes: number;

    @Field(() => Int)
    clinicComments: number;

    @Field(() => Int)
    clinicDoctors: number;

    @Field(() => Int)
    clinicRank: number;

    @Field(() => String)
    memberId: ObjectId;

    @Field(() => Date)
    createdAt: Date;

    @Field(() => Date)
    updatedAt: Date;

    /** from aggregation **/

    @Field(() => [MeLiked], {nullable: true})
    meLiked?: MeLiked[];

    @Field(() => Member, {nullable: true})
    memberData?: Member;
}

@ObjectType()
export class Clinics {
    @Field(() => [Clinic])
    list: Clinic[];

    @Field(() => [TotalCounter], {nullable: true})
    metaCounter: TotalCounter[];
}
