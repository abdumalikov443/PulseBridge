import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ObjectId } from 'mongoose';
import { AppointmentService } from './appointment.service';
import { Appointment, Appointments } from '../../libs/dto/appointment/appointment';
import { AppointmentInput, AppointmentsInquiry } from '../../libs/dto/appointment/appointment.input';
import { AppointmentUpdate } from '../../libs/dto/appointment/appointment.update';
import { Roles } from '../auth/decorators/roles.decorator';
import { MemberType } from '../../libs/enums/member.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { shapeIntoMongoObjectId } from '../../libs/config';

@Resolver()
export class AppointmentResolver {
    constructor(private readonly appointmentService: AppointmentService) {}

    @Roles(MemberType.PATIENT)
    @UseGuards(RolesGuard)
    @Mutation((returns) => Appointment)
    public async createAppointment(
        @Args('input') input: AppointmentInput,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Appointment> {
        console.log("Mutation: createAppointment");
        input.doctorId = shapeIntoMongoObjectId(input.doctorId);
        return await this.appointmentService.createAppointment(memberId, input);
    }

    // patient cancels; doctor or clinic owner completes / cancels
    @UseGuards(AuthGuard)
    @Mutation((returns) => Appointment)
    public async updateAppointment(
        @Args('input') input: AppointmentUpdate,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Appointment> {
        console.log("Mutation: updateAppointment");
        input._id = shapeIntoMongoObjectId(input._id);
        return await this.appointmentService.updateAppointment(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Appointments)
    public async getMyAppointments(
        @Args('input') input: AppointmentsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Appointments> {
        console.log("Query: getMyAppointments");
        return await this.appointmentService.getMyAppointments(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Query((returns) => Appointments)
    public async getDoctorAppointments(
        @Args('input') input: AppointmentsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Appointments> {
        console.log("Query: getDoctorAppointments");
        return await this.appointmentService.getDoctorAppointments(memberId, input);
    }

    @Roles(MemberType.CLINIC)
    @UseGuards(RolesGuard)
    @Query((returns) => Appointments)
    public async getClinicAppointments(
        @Args('input') input: AppointmentsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Appointments> {
        console.log("Query: getClinicAppointments");
        return await this.appointmentService.getClinicAppointments(memberId, input);
    }

    /** ADMIN **/

    @Roles(MemberType.ADMIN)
    @UseGuards(RolesGuard)
    @Query((returns) => Appointments)
    public async getAllAppointmentsByAdmin(@Args('input') input: AppointmentsInquiry): Promise<Appointments> {
        console.log("Query: getAllAppointmentsByAdmin");
        return await this.appointmentService.getAllAppointmentsByAdmin(input);
    }
}
