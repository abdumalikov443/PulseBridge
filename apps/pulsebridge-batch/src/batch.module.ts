import { Module } from '@nestjs/common';
import { BatchController } from './batch.controller';
import { BatchService } from './batch.service';
import { ConfigModule} from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { ScheduleModule } from '@nestjs/schedule';
import { MongooseModule } from '@nestjs/mongoose';
import DoctorSchema from 'apps/pulsebridge-api/src/schemas/Doctor.model';
import ClinicSchema from 'apps/pulsebridge-api/src/schemas/Clinic.model';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([{name: "Doctor", schema: DoctorSchema}]),
    MongooseModule.forFeature([{name: "Clinic", schema: ClinicSchema}]),
  ],
  controllers: [BatchController],
  providers: [BatchService],
})
export class PulseBridgeBatchModule {}
