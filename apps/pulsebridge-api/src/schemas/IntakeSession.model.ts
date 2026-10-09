import { Schema } from 'mongoose';
import { DoctorSpecialty } from '../libs/enums/doctor.enum';
import { IntakeUrgency } from '../libs/enums/intake.enum';

const IntakeSessionSchema = new Schema(
	{
		// random key known only to the client (guest sessions have no member yet)
		sessionKey: {
			type: String,
			required: true,
			unique: true,
		},

		// set when a logged-in patient chats or claims the guest session
		memberId: {
			type: Schema.Types.ObjectId,
			default: null,
			ref: 'Member',
		},

		// for the per-IP guest limit only
		ip: {
			type: String,
		},

		messages: {
			type: [
				{
					_id: false,
					role: { type: String, enum: ['user', 'assistant'], required: true },
					content: { type: String, required: true },
				},
			],
			default: [],
		},

		ready: {
			type: Boolean,
			default: false,
		},

		specialty: {
			type: String,
			enum: [...Object.values(DoctorSpecialty), null],
			default: null,
		},

		urgency: {
			type: String,
			enum: IntakeUrgency,
			default: IntakeUrgency.ROUTINE,
		},

		complaintSummary: {
			type: String,
			default: '',
		},

		// health data: MongoDB deletes the session at this time (24h for guests)
		expiresAt: {
			type: Date,
			required: true,
		},
	},
	{ timestamps: true, collection: 'intakeSessions' },
);

IntakeSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
IntakeSessionSchema.index({ ip: 1, createdAt: -1 });
IntakeSessionSchema.index({ memberId: 1, createdAt: -1 });

export default IntakeSessionSchema;
