import { registerEnumType } from '@nestjs/graphql';

export enum DoctorSpecialty {
	CARDIOLOGY = 'CARDIOLOGY',
	DERMATOLOGY = 'DERMATOLOGY',
	PEDIATRICS = 'PEDIATRICS',
	NEUROLOGY = 'NEUROLOGY',
	DENTISTRY = 'DENTISTRY',
	UROLOGY = 'UROLOGY',
	ONCOLOGY = 'ONCOLOGY',
	ORTHOPEDY = 'ORTHOPEDY',
	GASTROENTEROLOGY = 'GASTROENTEROLOGY',
	GENERAL = 'GENERAL',
}
registerEnumType(DoctorSpecialty, {
	name: 'DoctorSpecialty',
});

// doctor's request to join a clinic (clinicJoinRequests)
export enum JoinRequestStatus {
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED',
}
registerEnumType(JoinRequestStatus, {
	name: 'JoinRequestStatus',
});
