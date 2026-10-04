import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Doctor } from 'apps/pulsebridge-api/src/libs/dto/doctor/doctor';
import { Clinic } from 'apps/pulsebridge-api/src/libs/dto/clinic/clinic';
import { ClinicStatus } from 'apps/pulsebridge-api/src/libs/enums/clinic.enum';
import { Model } from 'mongoose';

@Injectable()
export class BatchService {
  constructor (
    @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
    @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>
  ) {}

  public async batchRollback(): Promise<void> {
    await this.doctorModel
      .updateMany({}, { doctorRank: 0 })
      .exec();

    await this.clinicModel
      .updateMany(
        { clinicStatus: ClinicStatus.ACTIVE },
        { clinicRank: 0 },
      ).exec();
  }

  public async batchTopDoctors(): Promise<void> {
    const doctors: Doctor[] = await this.doctorModel
      .find({ doctorRank: 0 })
      .exec();

    const promisedList = doctors.map(async (ele: Doctor) => {
      const { _id, doctorLikes, doctorViews, doctorComments } = ele;
      const rank = doctorLikes * 2 + doctorComments * 2 + doctorViews * 1;
      return await this.doctorModel.findByIdAndUpdate(_id, { doctorRank: rank });
    });
    await Promise.all(promisedList);
  }

  public async batchTopClinics(): Promise<void> {
    const clinics: Clinic[] = await this.clinicModel
      .find({
        clinicStatus: ClinicStatus.ACTIVE,
        clinicRank: 0
      })
      .exec();

    const promisedList = clinics.map(async (ele: Clinic) => {
      const { _id, clinicLikes, clinicViews, clinicComments } = ele;
      const rank = clinicLikes * 2 + clinicComments * 2 + clinicViews * 1;
      return await this.clinicModel.findByIdAndUpdate(_id, { clinicRank: rank });
    });
    await Promise.all(promisedList);
  }

  public getHello(): string {
    return 'Welcome to PulseBridge BATCH Server!';
  }
}
