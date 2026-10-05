import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { ObjectId } from "mongoose";
import { DoctorService } from "./doctor.service";
import { Doctor, Doctors } from "../../libs/dto/doctor/doctor";
import { DoctorsInquiry, JoinRequestUpdate } from "../../libs/dto/doctor/doctor.input";
import { ClinicJoinRequest, ClinicJoinRequests } from "../../libs/dto/doctor/join-request";
import { DoctorUpdate } from "../../libs/dto/doctor/doctor.update";
import { OrdinaryInquiry } from "../../libs/dto/common/common.input";
import { Roles } from "../auth/decorators/roles.decorator";
import { MemberType } from "../../libs/enums/member.enum";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AuthGuard } from "../auth/guards/auth.guard";
import { WithoutGuard } from "../auth/guards/without.guard";
import { AuthMember } from "../auth/decorators/authMember.decorator";
import { shapeIntoMongoObjectId } from "../../libs/config";

@Resolver()
export class DoctorResolver {
    constructor(private readonly doctorService: DoctorService) { }

    /** JOIN REQUESTS **/

    @Roles(MemberType.DOCTOR)
    @UseGuards(RolesGuard)
    @Mutation(() => ClinicJoinRequest)
    public async requestJoinClinic(
        @Args('clinicId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<ClinicJoinRequest> {
        console.log("Mutation: requestJoinClinic");
        const clinicId = shapeIntoMongoObjectId(input);
        return await this.doctorService.requestJoinClinic(memberId, clinicId);
    }

    @Roles(MemberType.DOCTOR)
    @UseGuards(RolesGuard)
    @Mutation(() => ClinicJoinRequest)
    public async cancelJoinRequest(
        @Args('requestId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<ClinicJoinRequest> {
        console.log("Mutation: cancelJoinRequest");
        const requestId = shapeIntoMongoObjectId(input);
        return await this.doctorService.cancelJoinRequest(memberId, requestId);
    }

    @Roles(MemberType.DOCTOR)
    @UseGuards(RolesGuard)
    @Query(() => ClinicJoinRequests)
    public async getMyJoinRequests(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<ClinicJoinRequests> {
        console.log("Query: getMyJoinRequests");
        return await this.doctorService.getMyJoinRequests(memberId, input);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Query(() => ClinicJoinRequests)
    public async getClinicJoinRequests(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<ClinicJoinRequests> {
        console.log("Query: getClinicJoinRequests");
        return await this.doctorService.getClinicJoinRequests(memberId, input);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Mutation(() => ClinicJoinRequest)
    public async respondJoinRequest(
        @Args('input') input: JoinRequestUpdate,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<ClinicJoinRequest> {
        console.log("Mutation: respondJoinRequest");
        input._id = shapeIntoMongoObjectId(input._id);
        return await this.doctorService.respondJoinRequest(memberId, input);
    }

    @UseGuards(WithoutGuard)
    @Query((returns) => Doctor)
    public async getDoctor(
        @Args('doctorId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctor> {
        console.log("Query: getDoctor");
        const doctorId = shapeIntoMongoObjectId(input);
        return await this.doctorService.getDoctor(memberId, doctorId);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Doctor)
    public async getMyDoctorProfile(@AuthMember('_id') memberId: ObjectId): Promise<Doctor> {
        console.log("Query: getMyDoctorProfile");
        return await this.doctorService.getMyDoctorProfile(memberId);
    }

    @UseGuards(WithoutGuard)
    @Query((returns) => Doctors)
    public async getDoctors(
        @Args('input') input: DoctorsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctors> {
        console.log("Query: getDoctors");
        return await this.doctorService.getDoctors(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Mutation((returns) => Doctor)
    public async updateDoctor(
        @Args('input') input: DoctorUpdate,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctor> {
        console.log("Mutation: updateDoctor");
        input._id = shapeIntoMongoObjectId(input._id);
        return await this.doctorService.updateDoctor(memberId, input);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Doctor)
    public async removeDoctor(
        @Args('doctorId') input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctor> {
        console.log("Mutation: removeDoctor");
        const doctorId = shapeIntoMongoObjectId(input);
        return await this.doctorService.removeDoctor(memberId, doctorId);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Doctors)
    public async getFavoriteDoctors(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctors> {
        console.log("Query: getFavoriteDoctors");
        return await this.doctorService.getFavoriteDoctors(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Doctors)
    public async getVisitedDoctors(
        @Args('input') input: OrdinaryInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctors> {
        console.log("Query: getVisitedDoctors");
        return await this.doctorService.getVisitedDoctors(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Mutation(() => Doctor)
    public async likeTargetDoctor(
        @Args("doctorId") input: string,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Doctor> {
        console.log("Mutation: likeTargetDoctor");
        const likeRefId = shapeIntoMongoObjectId(input);
        return await this.doctorService.likeTargetDoctor(memberId, likeRefId);
    }

    /** ADMIN **/

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Doctor)
    public async removeDoctorByAdmin(@Args('doctorId') input: string): Promise<Doctor> {
        console.log("Mutation: removeDoctorByAdmin");
        const doctorId = shapeIntoMongoObjectId(input);
        return await this.doctorService.removeDoctorByAdmin(doctorId);
    }
}
