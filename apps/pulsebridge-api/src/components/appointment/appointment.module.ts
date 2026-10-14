import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentResolver } from './appointment.resolver';
import { AppointmentService } from './appointment.service';
import { DoctorAvailabilityResolver } from './doctor-availability.resolver';
import { AppointmentController } from './appointment.controller';
import AppointmentSchema from '../../schemas/Appointment.model';
import { AuthModule } from '../auth/auth.module';
import { DoctorModule } from '../doctor/doctor.module';
import { ClinicModule } from '../clinic/clinic.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([{name: "Appointment", schema: AppointmentSchema}]),
        AuthModule,
        DoctorModule,
        ClinicModule,
        NotificationModule
    ],
    controllers: [AppointmentController],
    providers: [AppointmentResolver, DoctorAvailabilityResolver, AppointmentService],
})
export class AppointmentModule {}
