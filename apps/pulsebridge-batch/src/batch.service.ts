import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Doctor } from 'apps/pulsebridge-api/src/libs/dto/doctor/doctor';
import { Clinic } from 'apps/pulsebridge-api/src/libs/dto/clinic/clinic';
import { clinicRankExpr, doctorRankExpr } from 'apps/pulsebridge-api/src/libs/rank';
import { Model } from 'mongoose';

// the API keeps ranks up to date on every like / follow / comment / view;
// the nightly run only recalculates them from the counters as a safety net (no reset to 0)
@Injectable()
export class BatchService {
  constructor (
    @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
    @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>
  ) {}

  public async batchTopDoctors(): Promise<void> {
    await this.doctorModel.updateMany({}, [{ $set: { doctorRank: doctorRankExpr } }]).exec();
  }

  public async batchTopClinics(): Promise<void> {
    await this.clinicModel.updateMany({}, [{ $set: { clinicRank: clinicRankExpr } }]).exec();
  }

  public getHello(): string {
    return 'Welcome to PulseBridge BATCH Server!';
  }
}
