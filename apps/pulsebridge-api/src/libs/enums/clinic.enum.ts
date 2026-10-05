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
