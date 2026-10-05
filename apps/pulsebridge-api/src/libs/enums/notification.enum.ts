import { registerEnumType } from '@nestjs/graphql';

export enum NotificationType {
	LIKE = 'LIKE',
	COMMENT = 'COMMENT',
	FOLLOW = 'FOLLOW',
	APPOINTMENT = 'APPOINTMENT',
	DOCTOR_REQUEST = 'DOCTOR_REQUEST',
}
registerEnumType(NotificationType, {
	name: 'NotificationType',
});

export enum NotificationStatus {
	WAIT = 'WAIT',
	READ = 'READ',
}
registerEnumType(NotificationStatus, {
	name: 'NotificationStatus',
});

export enum NotificationGroup {
	MEMBER = 'MEMBER',
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
	ARTICLE = 'ARTICLE',
}
registerEnumType(NotificationGroup, {
	name: 'NotificationGroup',
});
