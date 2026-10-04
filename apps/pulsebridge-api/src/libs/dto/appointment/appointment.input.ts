import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, Length, Matches, Min } from 'class-validator';
import { ObjectId } from 'mongoose';
import { AppointmentStatus } from '../../enums/appointment.enum';
import { Direction } from '../../enums/common.enum';
import { availableAppointmentSorts } from '../../config';

@InputType()
export class AppointmentInput {
	@IsNotEmpty()
	@Field(() => String)
	doctorId: ObjectId;

	@IsNotEmpty()
	@Field(() => Date)
	appointmentDate: Date;

	@IsNotEmpty()
	@Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
	@Field(() => String)
	appointmentTime: string;

	@IsOptional()
	@Length(3, 500)
	@Field(() => String, { nullable: true })
	appointmentReason?: string;

	memberId?: ObjectId;

	clinicId?: ObjectId;
}

@InputType()
class APSearch {
	@IsOptional()
	@Field(() => AppointmentStatus, { nullable: true })
	appointmentStatus?: AppointmentStatus;

	// clinic owner and admin can filter by doctor
	@IsOptional()
	@Field(() => String, { nullable: true })
	doctorId?: ObjectId;
}

@InputType()
export class AppointmentsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableAppointmentSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => APSearch)
	search: APSearch;
}
