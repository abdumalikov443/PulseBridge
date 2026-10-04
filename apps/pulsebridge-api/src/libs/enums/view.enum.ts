import { registerEnumType } from '@nestjs/graphql';

export enum ViewGroup {
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
	ARTICLE = 'ARTICLE',
}
registerEnumType(ViewGroup, {
	name: 'ViewGroup',
});
