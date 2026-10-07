import { Schema } from 'mongoose';
import { ClinicStatus, ClinicType, WeekDay } from '../libs/enums/clinic.enum';

const ClinicSchema = new Schema(
	{
		clinicStatus: {
			type: String,
			enum: ClinicStatus,
			default: ClinicStatus.ACTIVE,
		},

		clinicType: {
			type: String,
			enum: ClinicType,
			required: true,
		},

		clinicName: {
			type: String,
			required: true,
		},

		clinicAddress: {
			type: String,
			required: true,
		},

		clinicDesc: {
			type: String,
			required: true,
		},

		clinicImage: {
			type: String,
		},

		// working hours "HH:mm" (half hours) in the platform timezone; doctors work on this schedule
		clinicOpenTime: {
			type: String,
			default: '09:00',
		},

		clinicCloseTime: {
			type: String,
			default: '18:00',
		},

		clinicBreakStart: {
			type: String,
			default: null,
		},

		clinicBreakEnd: {
			type: String,
			default: null,
		},

		clinicOffDays: {
			type: [String],
			enum: WeekDay,
			default: [],
		},

		clinicViews: {
			type: Number,
			default: 0,
		},

		clinicLikes: {
			type: Number,
			default: 0,
		},

		clinicComments: {
			type: Number,
			default: 0,
		},

		// number of doctors working in the clinic
		clinicDoctors: {
			type: Number,
			default: 0,
		},

		clinicFollowers: {
			type: Number,
			default: 0,
		},

		clinicRank: {
			type: Number,
			default: 0,
		},

		// CLINIC member who owns this clinic (1 member = 1 clinic)
		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			unique: true,
			ref: 'Member',
		},
	},
	{ timestamps: true, collection: 'clinics' },
);

export default ClinicSchema;
