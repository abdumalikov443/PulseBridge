import { Field, ObjectType } from '@nestjs/graphql';
import { ObjectId } from 'mongoose';
import { FollowGroup } from '../../enums/follow.enum';
import { Member, TotalCounter } from '../member/member';
import { Doctor } from '../doctor/doctor';
import { Clinic } from '../clinic/clinic';
import { MeFollowed } from './me-followed';

@ObjectType()
export class Follow {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String)
	followerId: ObjectId;

	@Field(() => FollowGroup)
	followGroup: FollowGroup;

	@Field(() => String)
	followRefId: ObjectId;

	@Field(() => Date)
	createdAt: Date;

	@Field(() => Date)
	updatedAt: Date;

	/** from aggregation **/

	// does the viewer follow the same doctor / clinic
	@Field(() => [MeFollowed], { nullable: true })
	meFollowed?: MeFollowed[];

	// getFollowers: who follows
	@Field(() => Member, { nullable: true })
	followerData?: Member;

	// getMemberFollowings: what is followed (one of them)
	@Field(() => Doctor, { nullable: true })
	doctorData?: Doctor;

	@Field(() => Clinic, { nullable: true })
	clinicData?: Clinic;
}

@ObjectType()
export class Follows {
	@Field(() => [Follow])
	list: Follow[];

	@Field(() => [TotalCounter], { nullable: true })
	metaCounter: TotalCounter[];
}
