import { Schema } from 'mongoose';
import { NotificationGroup, NotificationStatus, NotificationType } from '../libs/enums/notification.enum';

const NotificationSchema = new Schema(
	{
		notificationType: {
			type: String,
			enum: NotificationType,
			required: true,
		},

		notificationStatus: {
			type: String,
			enum: NotificationStatus,
			default: NotificationStatus.WAIT,
		},

		notificationGroup: {
			type: String,
			enum: NotificationGroup,
			required: true,
		},

		notificationTitle: {
			type: String,
			required: true,
		},

		notificationDesc: {
			type: String,
		},

		authorId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

		receiverId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},

		// liked / commented / followed doctor, clinic or article: lets an unlike / unfollow remove the notification
		notificationRefId: {
			type: Schema.Types.ObjectId,
		},

		// removed with the comment (author delete, admin BLOCK / remove, article delete)
		commentId: {
			type: Schema.Types.ObjectId,
			ref: 'Comment',
		},

		articleId: {
			type: Schema.Types.ObjectId,
			ref: 'Article',
		},

		appointmentId: {
			type: Schema.Types.ObjectId,
			ref: 'Appointment',
		},
	},
	{ timestamps: true, collection: 'notifications' },
);

NotificationSchema.index({ authorId: 1, notificationType: 1, notificationRefId: 1 });
NotificationSchema.index({ commentId: 1 }, { sparse: true });

// the bell: a member's notifications and the unread count
NotificationSchema.index({ receiverId: 1, notificationStatus: 1, createdAt: -1 });

export default NotificationSchema;
