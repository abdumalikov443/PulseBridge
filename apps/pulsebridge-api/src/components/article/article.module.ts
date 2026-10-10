import { Module } from '@nestjs/common';
import { ArticleResolver } from './article.resolver';
import { ArticleService } from './article.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ViewModule } from '../view/view.module';
import ArticleSchema from '../../schemas/Article.model';
import DoctorSchema from '../../schemas/Doctor.model';
import ClinicSchema from '../../schemas/Clinic.model';
import CommentSchema from '../../schemas/Comment.model';
import { MemberModule } from '../member/member.module';
import { LikeModule } from '../like/like.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([{name: "Article", schema: ArticleSchema}]),
    // who may write: doctor working in a clinic / active clinic (models only)
    MongooseModule.forFeature([{name: "Doctor", schema: DoctorSchema}]),
    MongooseModule.forFeature([{name: "Clinic", schema: ClinicSchema}]),
    // deleting an article deletes its comments (model only: CommentModule imports ArticleModule)
    MongooseModule.forFeature([{name: "Comment", schema: CommentSchema}]),
    AuthModule,
    ViewModule,
    MemberModule,
    LikeModule,
    NotificationModule
  ],
  providers: [ArticleResolver, ArticleService],
  exports: [ArticleService]
})
export class ArticleModule {}
