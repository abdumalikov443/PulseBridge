import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DoctorResolver } from './doctor.resolver';
import { DoctorService } from './doctor.service';
import DoctorSchema from '../../schemas/Doctor.model';
import AppointmentSchema from '../../schemas/Appointment.model';
import { AuthModule } from '../auth/auth.module';
import { MemberModule } from '../member/member.module';
import { ClinicModule } from '../clinic/clinic.module';
import { ViewModule } from '../view/view.module';
import { LikeModule } from '../like/like.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([{name: "Doctor", schema: DoctorSchema}]),
        MongooseModule.forFeature([{name: "Appointment", schema: AppointmentSchema}]),
        AuthModule,
        MemberModule,
        ClinicModule,
        ViewModule,
        LikeModule,
        NotificationModule
    ],
    providers: [DoctorResolver, DoctorService],
    exports: [DoctorService]
})
export class DoctorModule {}
