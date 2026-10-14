import { BadRequestException, ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId, PipelineStage } from 'mongoose';
import moment from 'moment';
import { Appointment, Appointments } from '../../libs/dto/appointment/appointment';
import { AppointmentInput, AppointmentsInquiry } from '../../libs/dto/appointment/appointment.input';
import { AppointmentUpdate } from '../../libs/dto/appointment/appointment.update';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberType } from '../../libs/enums/member.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';
import { T } from '../../libs/types/common';
import { getAppTimezone, lookupClinic, lookupDoctor, lookupMember, shapeIntoMongoObjectId, zonedTimeToDate } from '../../libs/config';
import { DoctorService } from '../doctor/doctor.service';
import { ClinicService } from '../clinic/clinic.service';
import { NotificationService } from '../notification/notification.service';
import { AppointmentActor, canChangeAppointmentStatus } from './appointment.policy';
import { DayAvailability, NextSlot } from '../../libs/dto/appointment/availability';
import { Doctor } from '../../libs/dto/doctor/doctor';
import { Member } from '../../libs/dto/member/member';
import { getBookableDates, getScheduleSlots, getWeekDay, isOpenDay, withScheduleDefaults } from '../../libs/schedule';

@Injectable()
export class AppointmentService {
    constructor(
        @InjectModel("Appointment") private readonly appointmentModel: Model<Appointment>,
        private doctorService: DoctorService,
        private clinicService: ClinicService,
        private notificationService: NotificationService,
    ) {}

    // next 5 days from tomorrow: 30-minute slots of the doctor's clinic, booked ones marked unavailable
    public async getDoctorAvailability(doctorId: ObjectId): Promise<DayAvailability[]> {
        const doctor = await this.doctorService.getDoctor(null as unknown as ObjectId, doctorId);
        const schedule = withScheduleDefaults(doctor.clinicData);
        const dates = getBookableDates();

        const booked = await this.appointmentModel
            .find({
                doctorId: doctorId,
                appointmentStatus: AppointmentStatus.CONFIRMED,
                appointmentDate: { $in: dates.map((date) => moment.utc(date, 'YYYY-MM-DD').toDate()) },
            })
            .select({ appointmentDate: 1, appointmentTime: 1 })
            .lean()
            .exec();
        const taken = new Set(booked.map((a) => `${moment.utc(a.appointmentDate).format('YYYY-MM-DD')} ${a.appointmentTime}`));

        return dates.map((date) => {
            const isOpen = isOpenDay(schedule, date);
            return {
                date: date,
                dayOfWeek: getWeekDay(date),
                isOpen: isOpen,
                slots: isOpen ? getScheduleSlots(schedule).map((time) => ({ time: time, available: !taken.has(`${date} ${time}`) })) : [],
            };
        });
    }

    // first free slot for a doctor card, from the clinic data the doctor list already carries (one query)
    public async getNextAvailable(doctor: Doctor): Promise<NextSlot | null> {
        if (!doctor.clinicId || !doctor.clinicData) return null;
        const schedule = withScheduleDefaults(doctor.clinicData);
        const dates = getBookableDates().filter((date) => isOpenDay(schedule, date));
        if (!dates.length) return null;

        const booked = await this.appointmentModel
            .find({
                doctorId: doctor._id,
                appointmentStatus: AppointmentStatus.CONFIRMED,
                appointmentDate: { $in: dates.map((date) => moment.utc(date, 'YYYY-MM-DD').toDate()) },
            })
            .select({ appointmentDate: 1, appointmentTime: 1 })
            .lean()
            .exec();
        const taken = new Set(booked.map((a) => `${moment.utc(a.appointmentDate).format('YYYY-MM-DD')} ${a.appointmentTime}`));
        const slots = getScheduleSlots(schedule);

        for (const date of dates) {
            const time = slots.find((slot) => !taken.has(`${date} ${slot}`));
            if (time) return { date, time };
        }
        return null;
    }

    public async createAppointment(memberId: ObjectId, input: AppointmentInput): Promise<Appointment> {
        // only active doctors in active clinics can be booked
        const doctor = await this.doctorService.getDoctor(null as unknown as ObjectId, input.doctorId);
        if (String(doctor.memberId) === String(memberId)) throw new BadRequestException(Message.SELF_APPOINTMENT_DENIED);

        // calendar day stored as UTC midnight: the same "YYYY-MM-DD" on any server timezone
        const day = moment.utc(input.appointmentDate, 'YYYY-MM-DD', true);
        if (!day.isValid()) throw new BadRequestException(Message.INVALID_APPOINTMENT_DATE);
        // the slot is a wall-clock time of the platform timezone (APP_TIMEZONE)
        if (zonedTimeToDate(input.appointmentDate, input.appointmentTime, getAppTimezone()) <= new Date()) {
            throw new BadRequestException(Message.PAST_APPOINTMENT);
        }
        // a 30-minute slot of the clinic's working hours, on a working day in the next 5 days from tomorrow
        const schedule = withScheduleDefaults(doctor.clinicData);
        const inSchedule = getBookableDates().includes(input.appointmentDate)
            && isOpenDay(schedule, input.appointmentDate)
            && getScheduleSlots(schedule).includes(input.appointmentTime);
        if (!inSchedule) throw new BadRequestException(Message.NOT_IN_SCHEDULE);

        const slot = {
            doctorId: input.doctorId,
            appointmentDate: day.toDate(),
            appointmentTime: input.appointmentTime,
        };
        const taken = await this.appointmentModel
            .exists({ ...slot, appointmentStatus: AppointmentStatus.CONFIRMED })
            .exec();
        if (taken) throw new BadRequestException(Message.SLOT_TAKEN);

        let result: Appointment;
        try {
            result = await this.appointmentModel.create({
                ...slot,
                appointmentReason: input.appointmentReason,
                memberId: memberId,
                clinicId: doctor.clinicId, // getDoctor returns only doctors working in a clinic
            });
        } catch (err: any) {
            console.log("Error, Service.model: ", err.message);
            // unique index: someone booked the same slot at the same moment
            if (err.code === 11000) throw new BadRequestException(Message.SLOT_TAKEN);
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        await this.notificationService.createNotification({
            notificationType: NotificationType.APPOINTMENT,
            notificationGroup: NotificationGroup.DOCTOR,
            notificationTitle: "New appointment",
            notificationDesc: `${day.format('YYYY-MM-DD')} ${input.appointmentTime}`,
            authorId: memberId,
            receiverId: doctor.memberId,
            appointmentId: result._id,
        });
        return result;
    }

    public async updateAppointment(memberId: ObjectId, input: AppointmentUpdate): Promise<Appointment> {
        const appointment = await this.appointmentModel.findById(input._id).exec();
        if (!appointment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const actor = await this.getActor(memberId, appointment);
        if (!actor) throw new ForbiddenException(Message.NOT_ALLOWED_REQUEST);
        if (!canChangeAppointmentStatus(actor, appointment.appointmentStatus, input.appointmentStatus)) {
            throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);
        }

        const result = await this.appointmentModel
            .findOneAndUpdate(
                { _id: input._id, appointmentStatus: AppointmentStatus.CONFIRMED },
                { appointmentStatus: input.appointmentStatus },
                { new: true },
            )
            .exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

        // patient's action goes to the doctor, others' action goes to the patient
        const receiverId = actor === MemberType.PATIENT
            ? (await this.doctorService.getDoctorById(appointment.doctorId)).memberId
            : appointment.memberId;
        await this.notificationService.createNotification({
            notificationType: NotificationType.APPOINTMENT,
            notificationGroup: NotificationGroup.DOCTOR,
            notificationTitle: `Appointment ${input.appointmentStatus.toLowerCase()}`,
            notificationDesc: `${moment.utc(appointment.appointmentDate).format('YYYY-MM-DD')} ${appointment.appointmentTime}`,
            authorId: memberId,
            receiverId: receiverId,
            appointmentId: appointment._id,
        });
        return result;
    }

    private async getActor(memberId: ObjectId, appointment: Appointment): Promise<AppointmentActor | null> {
        if (String(appointment.memberId) === String(memberId)) return MemberType.PATIENT;
        if (await this.doctorService.isDoctorMember(appointment.doctorId, memberId)) return MemberType.DOCTOR;
        if (await this.clinicService.isClinicOwner(appointment.clinicId, memberId)) return MemberType.CLINIC;
        return null;
    }

    public async getMyAppointments(memberId: ObjectId, input: AppointmentsInquiry): Promise<Appointments> {
        return await this.getAppointmentList({ memberId: memberId }, input);
    }

    public async getDoctorAppointments(memberId: ObjectId, input: AppointmentsInquiry): Promise<Appointments> {
        // any doctor profile: a doctor who left the clinic still sees his history
        const doctor = await this.doctorService.getDoctorProfileByMember(memberId);
        return await this.getAppointmentList({ doctorId: doctor._id }, input);
    }

    public async getClinicAppointments(memberId: ObjectId, input: AppointmentsInquiry): Promise<Appointments> {
        const clinic = await this.clinicService.getMyClinic(memberId);
        const match: T = { clinicId: clinic._id };
        if (input.search?.doctorId) match.doctorId = shapeIntoMongoObjectId(input.search.doctorId);
        return await this.getAppointmentList(match, input);
    }

    /** ADMIN **/

    public async getAllAppointmentsByAdmin(input: AppointmentsInquiry): Promise<Appointments> {
        const match: T = {};
        if (input.search?.doctorId) match.doctorId = shapeIntoMongoObjectId(input.search.doctorId);
        return await this.getAppointmentList(match, input);
    }

    // one appointment with patient, doctor and clinic data; only its patient, doctor, clinic owner or ADMIN
    public async getAppointment(authMember: Member, appointmentId: ObjectId): Promise<Appointment> {
        const result = await this.appointmentModel
            .aggregate([{ $match: { _id: appointmentId } }, ...this.appointmentDataStages()])
            .exec();
        const appointment: Appointment = result[0];
        if (!appointment) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const me = String(authMember._id);
        const allowed = authMember.memberType === MemberType.ADMIN
            || String(appointment.memberId) === me
            || String(appointment.doctorData?.memberId) === me
            || String(appointment.clinicData?.memberId) === me;
        if (!allowed) throw new ForbiddenException(Message.NOT_ALLOWED_REQUEST);
        return appointment;
    }

    // data for the downloadable document; a cancelled appointment has none
    public async getAppointmentDocument(authMember: Member, appointmentId: ObjectId): Promise<Appointment> {
        const appointment = await this.getAppointment(authMember, appointmentId);
        if (appointment.appointmentStatus === AppointmentStatus.CANCELLED) throw new BadRequestException(Message.APPOINTMENT_CANCELLED);
        return appointment;
    }

    private appointmentDataStages(): PipelineStage.FacetPipelineStage[] {
        return [
            lookupMember,
            { $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
            lookupDoctor,
            { $unwind: { path: '$doctorData', preserveNullAndEmptyArrays: true } },
            lookupClinic,
            { $unwind: { path: '$clinicData', preserveNullAndEmptyArrays: true } },
        ];
    }

    private async getAppointmentList(match: T, input: AppointmentsInquiry): Promise<Appointments> {
        if (input.search?.appointmentStatus) match.appointmentStatus = input.search.appointmentStatus;
        const sort: T = { [input?.sort ?? 'appointmentDate'] : input?.direction ?? Direction.DESC };

        const result = await this.appointmentModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            ...this.appointmentDataStages(),
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }
}
