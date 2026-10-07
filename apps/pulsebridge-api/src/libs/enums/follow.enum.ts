import { registerEnumType } from '@nestjs/graphql';

// what a member follows: a doctor profile or a clinic
export enum FollowGroup {
	DOCTOR = 'DOCTOR',
	CLINIC = 'CLINIC',
}
registerEnumType(FollowGroup, {
	name: 'FollowGroup',
});
