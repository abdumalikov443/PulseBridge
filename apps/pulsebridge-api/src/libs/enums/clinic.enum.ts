import { registerEnumType } from '@nestjs/graphql';

export enum ClinicStatus {
	ACTIVE = 'ACTIVE',
	PAUSE = 'PAUSE',
	DELETE = 'DELETE',
}
registerEnumType(ClinicStatus, {
	name: 'ClinicStatus',
});

export enum ClinicType {
	PRIVATE = 'PRIVATE',
	PUBLIC = 'PUBLIC',
}
registerEnumType(ClinicType, {
	name: 'ClinicType',
});

// clinic days off (clinicOffDays) and days in a doctor availability list
export enum WeekDay {
	MON = 'MON',
	TUE = 'TUE',
	WED = 'WED',
	THU = 'THU',
	FRI = 'FRI',
	SAT = 'SAT',
	SUN = 'SUN',
}
registerEnumType(WeekDay, {
	name: 'WeekDay',
});
