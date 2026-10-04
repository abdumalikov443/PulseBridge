import { registerEnumType } from '@nestjs/graphql';

export enum LikeGroup {
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
	ARTICLE = 'ARTICLE',
}
registerEnumType(LikeGroup, {
	name: 'LikeGroup',
});
