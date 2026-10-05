import { ClinicService } from "./clinic.service";
import { Clinic, Clinics } from "../../libs/dto/clinic/clinic";
import { AllClinicsInquiry, ClinicsInquiry } from "../../libs/dto/clinic/clinic.input";
import { ClinicUpdate } from "../../libs/dto/clinic/clinic.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { Roles } from "../auth/decorators/roles.decorator";
import { MemberType } from "../../libs/enums/member.enum";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { ObjectId } from "mongoose";
import { WithoutGuard } from "../auth/guards/without.guard";
import { shapeIntoMongoObjectId } from "../../libs/config";
import { AuthGuard } from "../auth/guards/auth.guard";

@Resolver()
export class ClinicResolver {
    constructor(private readonly clinicService: ClinicService) { }

    @UseGuards(WithoutGuard)
    @Query((returns) => Clinic)
    public async getClinic(
        @Args('clinicId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinic> {
        console.log("Query: getClinic");
        const clinicId = shapeIntoMongoObjectId(input);
        return await this.clinicService.getClinic(memberId, clinicId);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Query((returns) => Clinic)
    public async getMyClinic(@AuthMember('_id') memberId: ObjectId): Promise<Clinic> {
        console.log("Query: getMyClinic");
        return await this.clinicService.getMyClinic(memberId);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Clinic)
    public async updateClinic(
        @Args('input') input: ClinicUpdate,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinic> {
        console.log("Mutation: updateClinic");
        input._id = shapeIntoMongoObjectId(input._id);
        return await this.clinicService.updateClinic(memberId, input);
    }

    @UseGuards(WithoutGuard)
    @Query((returns) => Clinics)
    public async getClinics(
        @Args('input') input: ClinicsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinics> {
        console.log("Query: getClinics");
        return await this.clinicService.getClinics(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Clinics)
    public async getFavoriteClinics(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinics> {
        console.log("Query: getFavoriteClinics");
        return await this.clinicService.getFavoriteClinics(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Clinics)
    public async getVisitedClinics(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinics> {
        console.log("Query: getVisitedClinics");
        return await this.clinicService.getVisitedClinics(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Mutation(() => Clinic)
    public async likeTargetClinic(
        @Args("clinicId") input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Clinic> {
        console.log("Mutation: likeTargetClinic");
        const likeRefId = shapeIntoMongoObjectId(input);
        return await this.clinicService.likeTargetClinic(memberId, likeRefId);
    }

    /** ADMIN **/

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Query((returns) => Clinics)
    public async getAllClinicsByAdmin(
        @Args('input') input: AllClinicsInquiry
    ): Promise<Clinics> {
        console.log("Query: getAllClinicsByAdmin");
        return await this.clinicService.getAllClinicsByAdmin(input);
    }

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Clinic)
    public async updateClinicByAdmin(@Args('input') input: ClinicUpdate): Promise<Clinic> {
        console.log("Mutation: updateClinicByAdmin");
        input._id = shapeIntoMongoObjectId(input._id);
        return await this.clinicService.updateClinicByAdmin(input);
    }

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Clinic)
    public async removeClinicByAdmin(@Args('clinicId') input: string): Promise<Clinic> {
        console.log("Mutation: removeClinicByAdmin");
        const clinicId = shapeIntoMongoObjectId(input);
        return await this.clinicService.removeClinicByAdmin(clinicId);
    }
}
