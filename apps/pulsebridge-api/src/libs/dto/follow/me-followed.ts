import { Field, ObjectType } from '@nestjs/graphql';
import { ObjectId } from 'mongoose';

// kept apart from follow.ts: doctor.ts and clinic.ts import it, follow.ts imports them
@ObjectType()
export class MeFollowed {
	@Field(() => String)
	followerId: ObjectId;

	@Field(() => String)
	followRefId: ObjectId;

	@Field(() => Boolean)
	myFollowing: boolean;
}
