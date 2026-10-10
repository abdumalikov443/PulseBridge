import mongoose, { Schema } from 'mongoose';
import { FaqTopic, NoticeCategory, NoticeStatus } from '../libs/enums/notice.enum';

// FAQ and notices, managed by ADMIN
const NoticeSchema = new Schema(
	{
		noticeCategory: {
			type: String,
			enum: NoticeCategory,
			required: true,
		},

		noticeStatus: {
			type: String,
			enum: NoticeStatus,
			default: NoticeStatus.ACTIVE,
		},

		// only for FAQ, null for NOTICE
		faqTopic: {
			type: String,
			enum: [...Object.values(FaqTopic), null],
			default: null,
		},

		noticeTitle: {
			type: String,
			required: true,
		},

		noticeContent: {
			type: String,
			required: true,
		},

		// pinned ones are listed first
		noticePinned: {
			type: Boolean,
			default: false,
		},

		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},
	},
	{ timestamps: true, collection: 'notices' },
);

NoticeSchema.index({ noticeCategory: 1, noticeStatus: 1, noticePinned: -1, createdAt: -1 });

export default NoticeSchema;
