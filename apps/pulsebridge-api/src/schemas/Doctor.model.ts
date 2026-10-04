import { Schema } from 'mongoose';
import { DoctorSpecialty } from '../libs/enums/doctor.enum';

const DoctorSchema = new Schema(
	{
		// a member can be a doctor in only one clinic
		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			unique: true,
			ref: 'Member',
		},

		clinicId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Clinic',
		},

		specialty: {
			type: String,
			enum: DoctorSpecialty,
			required: true,
		},

		experience: {
			type: Number,
			required: true,
			min: 0,
		},

		doctorViews: {
			type: Number,
			default: 0,
		},

		doctorLikes: {
			type: Number,
			default: 0,
		},

		doctorComments: {
			type: Number,
			default: 0,
		},

		doctorRank: {
			type: Number,
			default: 0,
		},
	},
	{ timestamps: true, collection: 'doctors' },
);

export default DoctorSchema;
