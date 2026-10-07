import { Module } from '@nestjs/common';
import { MemberResolver } from './member.resolver';
import { MemberService } from './member.service';
import { MongooseModule } from '@nestjs/mongoose';
import MemberSchema from '../../schemas/Member.model';
import { AuthModule } from '../auth/auth.module';
import DoctorSchema from '../../schemas/Doctor.model';
import ClinicSchema from '../../schemas/Clinic.model';

@Module({
  imports: [
    MongooseModule.forFeature([{name: "Member", schema: MemberSchema}]),
    // signup creates the DOCTOR / CLINIC profile (models only, no module import: ClinicModule imports MemberModule)
    MongooseModule.forFeature([{name: "Doctor", schema: DoctorSchema}]),
    MongooseModule.forFeature([{name: "Clinic", schema: ClinicSchema}]),
    AuthModule,
  ],
  providers: [MemberResolver, MemberService],
  exports: [MemberService]
})
export class MemberModule {}
