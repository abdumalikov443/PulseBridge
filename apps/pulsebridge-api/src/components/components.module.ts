import { Module } from '@nestjs/common';
import { MemberModule } from './member/member.module';
import { ClinicModule } from './clinic/clinic.module';
import { DoctorModule } from './doctor/doctor.module';
import { AuthModule } from './auth/auth.module';
import { CommentModule } from './comment/comment.module';
import { LikeModule } from './like/like.module';
import { ViewModule } from './view/view.module';
import { FollowModule } from './follow/follow.module';
import { ArticleModule } from './article/article.module';
import { AppointmentModule } from './appointment/appointment.module';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    MemberModule,
    AuthModule,
    ClinicModule,
    DoctorModule,
    AppointmentModule,
    NotificationModule,
    ArticleModule,
    LikeModule,
    ViewModule,
    CommentModule,
    FollowModule,
  ],
})
export class ComponentsModule { }
