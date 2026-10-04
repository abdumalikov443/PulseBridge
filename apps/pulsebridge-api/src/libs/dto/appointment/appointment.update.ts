import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsNotEmpty } from 'class-validator';
import { ObjectId } from 'mongoose';
import { AppointmentStatus } from '../../enums/appointment.enum';

@InputType()
export class AppointmentUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsNotEmpty()
	@IsIn([AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED])
	@Field(() => AppointmentStatus)
	appointmentStatus: AppointmentStatus;
}
