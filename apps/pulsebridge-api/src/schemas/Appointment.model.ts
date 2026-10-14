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

		// set by the batch server once the reminder notification for this visit was sent
		appointmentReminded: {
			type: Boolean,
			default: false,
		},
	},
	{ timestamps: true, collection: 'appointments' },
);

// one doctor cannot have two confirmed appointments at the same date and time
AppointmentSchema.index(
	{ doctorId: 1, appointmentDate: 1, appointmentTime: 1 },
	{ unique: true, partialFilterExpression: { appointmentStatus: AppointmentStatus.CONFIRMED } },
);

// "my appointments" of a patient / doctor / clinic, ordered by date
AppointmentSchema.index({ memberId: 1, appointmentStatus: 1, appointmentDate: 1 });
AppointmentSchema.index({ clinicId: 1, appointmentStatus: 1, appointmentDate: 1 });
// reminder batch: confirmed visits that have not been reminded yet
AppointmentSchema.index({ appointmentStatus: 1, appointmentReminded: 1, appointmentDate: 1 });

export default AppointmentSchema;
