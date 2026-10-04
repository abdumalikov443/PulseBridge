import { registerEnumType } from '@nestjs/graphql';

export enum CommentStatus {
	ACTIVE = 'ACTIVE',
	BLOCK = 'BLOCK',
	DELETE = 'DELETE',
}
registerEnumType(CommentStatus, {
	name: 'CommentStatus',
});

export enum CommentGroup {
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
	ARTICLE = 'ARTICLE',
}
registerEnumType(CommentGroup, {
	name: 'CommentGroup',
});
