import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Doctor } from 'apps/pulsebridge-api/src/libs/dto/doctor/doctor';
import { Clinic } from 'apps/pulsebridge-api/src/libs/dto/clinic/clinic';
import { Appointment } from 'apps/pulsebridge-api/src/libs/dto/appointment/appointment';
import { Notification } from 'apps/pulsebridge-api/src/libs/dto/notification/notification';
import { clinicRankExpr, doctorRankExpr } from 'apps/pulsebridge-api/src/libs/rank';
import { getAppTimezone, zonedTimeToDate } from 'apps/pulsebridge-api/src/libs/config';
import { AppointmentStatus } from 'apps/pulsebridge-api/src/libs/enums/appointment.enum';
import { NotificationGroup, NotificationType } from 'apps/pulsebridge-api/src/libs/enums/notification.enum';
import { Model } from 'mongoose';
import moment from 'moment';

// visits that start within this window get a reminder
const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

// the API keeps ranks up to date on every like / follow / comment / view;
// the nightly run only recalculates them from the counters as a safety net (no reset to 0)
@Injectable()
export class BatchService {
  constructor (
    @InjectModel("Doctor") private readonly doctorModel: Model<Doctor>,
    @InjectModel("Clinic") private readonly clinicModel: Model<Clinic>,
    @InjectModel("Appointment") private readonly appointmentModel: Model<Appointment>,
    @InjectModel("Notification") private readonly notificationModel: Model<Notification>,
  ) {}

  public async batchTopDoctors(): Promise<void> {
    await this.doctorModel.updateMany({}, [{ $set: { doctorRank: doctorRankExpr } }]).exec();
  }

  public async batchTopClinics(): Promise<void> {
    await this.clinicModel.updateMany({}, [{ $set: { clinicRank: clinicRankExpr } }]).exec();
  }

  // one reminder to the patient and one to the doctor for each confirmed visit starting in the next 24 hours;
  // the appointment is marked first, so a second (or parallel) run never sends it twice
  public async batchAppointmentReminders(): Promise<number> {
    const now = new Date();
    const until = new Date(now.getTime() + REMINDER_WINDOW_MS);
    // appointment days are stored as UTC midnight of the calendar day; one extra day on both sides covers the timezone
    const from = moment.utc(now).startOf('day').subtract(1, 'day').toDate();
    const to = moment.utc(until).startOf('day').add(1, 'day').toDate();

    const candidates = await this.appointmentModel
      .find({
        appointmentStatus: AppointmentStatus.CONFIRMED,
        appointmentReminded: { $ne: true },
        appointmentDate: { $gte: from, $lte: to },
      })
      .lean()
      .exec();

    let sent = 0;
    for (const appointment of candidates) {
      const day = moment.utc(appointment.appointmentDate).format('YYYY-MM-DD');
      const start = zonedTimeToDate(day, appointment.appointmentTime, getAppTimezone());
      if (start <= now || start > until) continue;

      const claimed = await this.appointmentModel
        .findOneAndUpdate({ _id: appointment._id, appointmentReminded: { $ne: true } }, { appointmentReminded: true })
        .exec();
      if (!claimed) continue;

      const doctor = await this.doctorModel.findById(appointment.doctorId).select({ memberId: 1 }).lean().exec();
      const base = {
        notificationType: NotificationType.APPOINTMENT,
        notificationGroup: NotificationGroup.DOCTOR,
        notificationTitle: "Appointment reminder",
        notificationDesc: `${day} ${appointment.appointmentTime}`,
        notificationRefId: appointment.doctorId,
        appointmentId: appointment._id,
      };
      const reminders: object[] = [
        { ...base, authorId: doctor?.memberId ?? appointment.memberId, receiverId: appointment.memberId },
      ];
      if (doctor?.memberId) reminders.push({ ...base, authorId: appointment.memberId, receiverId: doctor.memberId });
      await this.notificationModel.insertMany(reminders);
      sent++;
    }
    return sent;
  }

  public getHello(): string {
    return 'Welcome to PulseBridge BATCH Server!';
  }
}
