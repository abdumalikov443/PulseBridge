import { registerEnumType } from '@nestjs/graphql';

export enum AppointmentStatus {
	CONFIRMED = 'CONFIRMED',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED',
}
registerEnumType(AppointmentStatus, {
	name: 'AppointmentStatus',
});
