import { Schema } from 'mongoose';
import { AppointmentStatus } from '../libs/enums/appointment.enum';

const AppointmentSchema = new Schema(
	{
		appointmentDate: {
			type: Date,
			required: true,
		},

		// "HH:mm"
		appointmentTime: {
			type: String,
			required: true,
			match: /^([01]\d|2[0-3]):[0-5]\d$/,
		},

		appointmentStatus: {
			type: String,
			enum: AppointmentStatus,
			default: AppointmentStatus.CONFIRMED,
		},

		appointmentReason: {
			type: String,
		},

		// patient
		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

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
	},
	{ timestamps: true, collection: 'appointments' },
);

// one doctor cannot have two confirmed appointments at the same date and time
AppointmentSchema.index(
	{ doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
	{ unique: true, partialFilterExpression: { appointmentStatus: AppointmentStatus.CONFIRMED } },
);

export default AppointmentSchema;
