import { Module } from '@nestjs/common';
import { ClinicResolver } from './clinic.resolver';
import { ClinicService } from './clinic.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import ClinicSchema from '../../schemas/Clinic.model';
import { MemberModule } from '../member/member.module';
import { LikeModule } from '../like/like.module';
import { NotificationModule } from '../notification/notification.module';
import DoctorSchema from '../../schemas/Doctor.model';
import ClinicJoinRequestSchema from '../../schemas/ClinicJoinRequest.model';
import AppointmentSchema from '../../schemas/Appointment.model';

@Module({
    imports: [
        MongooseModule.forFeature([{name: "Clinic", schema: ClinicSchema}]),
        // models only (DoctorModule imports ClinicModule): deleting a clinic releases its doctors and requests
        MongooseModule.forFeature([{name: "Doctor", schema: DoctorSchema}]),
        MongooseModule.forFeature([{name: "ClinicJoinRequest", schema: ClinicJoinRequestSchema}]),
        MongooseModule.forFeature([{name: "Appointment", schema: AppointmentSchema}]),
        AuthModule,
        ViewModule,
        MemberModule,
        LikeModule,
        NotificationModule
    ],
    providers: [ClinicResolver, ClinicService],
    exports: [ClinicService]
})
export class ClinicModule {}
