import { registerEnumType } from '@nestjs/graphql';

export enum DoctorSpecialty {
	CARDIOLOGY = 'CARDIOLOGY',
	DERMATOLOGY = 'DERMATOLOGY',
	PEDIATRICS = 'PEDIATRICS',
	NEUROLOGY = 'NEUROLOGY',
	DENTISTRY = 'DENTISTRY',
	GENERAL = 'GENERAL',
}
registerEnumType(DoctorSpecialty, {
	name: 'DoctorSpecialty',
});
