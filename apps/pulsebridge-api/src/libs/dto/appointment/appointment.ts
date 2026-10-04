import { Field, ObjectType } from '@nestjs/graphql';
import { ObjectId } from 'mongoose';
import { AppointmentStatus } from '../../enums/appointment.enum';
import { Member, TotalCounter } from '../member/member';
import { Doctor } from '../doctor/doctor';
import { Clinic } from '../clinic/clinic';

@ObjectType()
export class Appointment {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => Date)
	appointmentDate: Date;

	@Field(() => String)
	appointmentTime: string;

	@Field(() => AppointmentStatus)
	appointmentStatus: AppointmentStatus;

	@Field(() => String, { nullable: true })
	appointmentReason?: string;

	@Field(() => String)
	memberId: ObjectId;

	@Field(() => String)
	doctorId: ObjectId;

	@Field(() => String)
	clinicId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation **/

	// patient
	@Field(() => Member, { nullable: true })
	memberData?: Member;

	@Field(() => Doctor, { nullable: true })
	doctorData?: Doctor;

	@Field(() => Clinic, { nullable: true })
	clinicData?: Clinic;
}

@ObjectType()
export class Appointments {
	@Field(() => [Appointment])
	list: Appointment[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
