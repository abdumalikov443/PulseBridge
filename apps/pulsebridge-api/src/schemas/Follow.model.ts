import { Schema } from 'mongoose';
import { FollowGroup } from '../libs/enums/follow.enum';

const FollowSchema = new Schema(
	{
		// member who follows
		followerId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

		followGroup: {
			type: String,
			enum: FollowGroup,
			required: true,
		},

		// doctors._id or clinics._id (same ids as likes, comments, appointments)
		followRefId: {
			type: Schema.Types.ObjectId,
			required: true,
		},
	},
	{ timestamps: true, collection: "follows" },
);

FollowSchema.index({ followerId: 1, followRefId: 1 }, { unique: true });

export default FollowSchema;
