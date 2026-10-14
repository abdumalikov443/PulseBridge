import { Field, ObjectType } from '@nestjs/graphql';
import { WeekDay } from '../../enums/clinic.enum';

@ObjectType()
export class TimeSlot {
	// "HH:mm" start of a 30-minute slot
	@Field(() => String)
	time: string;

	// false when a CONFIRMED appointment already takes it
	@Field(() => Boolean)
	available: boolean;
}

@ObjectType()
export class DayAvailability {
	// "YYYY-MM-DD"
	@Field(() => String)
	date: string;

	@Field(() => WeekDay)
	dayOfWeek: WeekDay;

	// false on the clinic's days off (no slots)
	@Field(() => Boolean)
	isOpen: boolean;

	@Field(() => [TimeSlot])
	slots: TimeSlot[];
}

// first free slot of a doctor (doctor cards); null when nothing is free in the bookable days
@ObjectType()
export class NextSlot {
	// "YYYY-MM-DD"
	@Field(() => String)
	date: string;

	// "HH:mm"
	@Field(() => String)
	time: string;
}
