import { Module } from '@nestjs/common';
import { CommentResolver } from './comment.resolver';
import { CommentService } from './comment.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import CommentSchema from '../../schemas/Comment.model';
import { DoctorModule } from '../doctor/doctor.module';
import { ClinicModule } from '../clinic/clinic.module';
import { ArticleModule } from '../article/article.module';

@Module({
  imports: [
    MongooseModule.forFeature([{name: "Comment", schema: CommentSchema}]),
    AuthModule,
    DoctorModule,
    ClinicModule,
    ArticleModule
  ],
  providers: [CommentResolver, CommentService]
})
export class CommentModule {}
