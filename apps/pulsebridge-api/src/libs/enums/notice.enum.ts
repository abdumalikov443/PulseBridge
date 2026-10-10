import { registerEnumType } from '@nestjs/graphql';

export enum NoticeCategory {
	FAQ = 'FAQ',
	NOTICE = 'NOTICE',
}
registerEnumType(NoticeCategory, {
	name: 'NoticeCategory',
});

// HOLD = draft / hidden from users
export enum NoticeStatus {
	HOLD = 'HOLD',
	ACTIVE = 'ACTIVE',
	DELETE = 'DELETE',
}
registerEnumType(NoticeStatus, {
	name: 'NoticeStatus',
});

// FAQ tabs (only for FAQ)
export enum FaqTopic {
	ACCOUNT = 'ACCOUNT',
	APPOINTMENT = 'APPOINTMENT',
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
	OTHER = 'OTHER',
}
registerEnumType(FaqTopic, {
	name: 'FaqTopic',
});
