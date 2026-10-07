import { Field, InputType, Int } from '@nestjs/graphql';
import { IsNotEmpty, Min } from 'class-validator';
import { ObjectId } from 'mongoose';
import { FollowGroup } from '../../enums/follow.enum';

// subscribe / unsubscribe target: doctors._id or clinics._id
@InputType()
export class FollowInput {
	@IsNotEmpty()
	@Field(() => FollowGroup)
	followGroup: FollowGroup;

	@IsNotEmpty()
	@Field(() => String)
	refId: ObjectId;
}

@InputType()
class FISearch {
	@IsNotEmpty()
	@Field(() => String)
	followerId: ObjectId;
}

// what a member follows
@InputType()
export class FollowingsInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => FISearch)
	search: FISearch;
}

// who follows a doctor / clinic
@InputType()
export class FollowersInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => FollowInput)
	search: FollowInput;
}
