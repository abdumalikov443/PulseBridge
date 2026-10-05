import { Schema } from 'mongoose';
import { JoinRequestStatus } from '../libs/enums/doctor.enum';

const ClinicJoinRequestSchema = new Schema(
	{
		doctorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Doctor',
		},

		clinicId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Clinic',
		},

		requestStatus: {
			type: String,
			enum: JoinRequestStatus,
			default: JoinRequestStatus.PENDING,
		},
	},
	{ timestamps: true, collection: 'clinicJoinRequests' },
);

// a doctor can have only one pending request at a time
ClinicJoinRequestSchema.index(
	{ doctorId: 1 },
	{ unique: true, partialFilterExpression: { requestStatus: JoinRequestStatus.PENDING } },
);

export default ClinicJoinRequestSchema;
