import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, Length } from "class-validator";
import { MemberStatus } from "../../enums/member.enum";
import { ObjectId } from "mongoose";


@InputType()
export class MemberUpdate {
    @IsNotEmpty()
    @Field(() => String)
    _id: ObjectId;

    // memberType is never changed after signup (one ADMIN, profiles tied to the role)
    @IsOptional()
    @Field(() => MemberStatus, {nullable: true})
    memberStatus?: MemberStatus;

    @IsNotEmpty()
    @Field(() => String, {nullable: true})
    memberPhone?: string;

    @IsOptional()
    @Length(3, 12)
    @Field(() => String, {nullable: true})
    memberNick?: string;

    @IsOptional()
    @Length(5, 12)
    @Field(() => String, {nullable: true})
    memberPassword?: string;

    @IsOptional()
    @Length(3, 100)
    @Field(() => String, {nullable: true})
    memberFullName?: string;

    @IsOptional()
    @Field(() => String, {nullable: true})
    memberImage?: string;

    @IsOptional()
    @Field(() => String, {nullable: true})
    memberAddress?: string;

    @IsOptional()
    @Field(() => String, {nullable: true})
    memberDesc?: string;

    deletedAt?: Date
}