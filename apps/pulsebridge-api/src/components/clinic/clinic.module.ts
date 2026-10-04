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

@Module({
    imports: [
        MongooseModule.forFeature([{name: "Clinic", schema: ClinicSchema}]),
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
