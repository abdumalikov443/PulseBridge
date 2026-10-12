import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Notification, Notifications } from '../../libs/dto/notification/notification';
import { NotificationInput, NotificationsInquiry } from '../../libs/dto/notification/notification.input';
import { NotificationStatus, NotificationType } from '../../libs/enums/notification.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';

@Injectable()
export class NotificationService {
    constructor(
        @InjectModel("Notification") private readonly notificationModel: Model<Notification>,
    ) {}

    // never breaks the main action: errors are only logged
    public async createNotification(input: NotificationInput): Promise<void> {
        if (String(input.authorId) === String(input.receiverId)) return;
        try {
            await this.notificationModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
        }
    }

    // unlike / unfollow: the receiver should no longer see it
    public async removeRefNotification(type: NotificationType, authorId: ObjectId, refId: ObjectId): Promise<void> {
        await this.notificationModel
            .deleteMany({ notificationType: type, authorId: authorId, $or: [{ notificationRefId: refId }, { articleId: refId }] })
            .exec();
    }

    // comment deleted, blocked or removed
    public async removeCommentNotifications(commentIds: ObjectId[]): Promise<void> {
        if (!commentIds.length) return;
        await this.notificationModel.deleteMany({ notificationType: NotificationType.COMMENT, commentId: { $in: commentIds } }).exec();
    }

    public async getNotifications(memberId: ObjectId, input: NotificationsInquiry): Promise<Notifications> {
        const { notificationStatus } = input.search;
        const match: T = { receiverId: memberId };
        if (notificationStatus) match.notificationStatus = notificationStatus;

        const result = await this.notificationModel
            .aggregate([
                { $match: match },
                { $sort: { createdAt: Direction.DESC } },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            {
                                $lookup: {
                                    from: 'members',
                                    localField: 'authorId',
                                    foreignField: '_id',
                                    as: 'authorData',
                                },
                            },
                            { $unwind: '$authorData' },
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    public async readNotification(memberId: ObjectId, notificationId: ObjectId): Promise<Notification> {
        const result = await this.notificationModel
            .findOneAndUpdate(
                { _id: notificationId, receiverId: memberId },
                { notificationStatus: NotificationStatus.READ },
                { new: true },
            )
            .exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    public async readAllNotifications(memberId: ObjectId): Promise<boolean> {
        await this.notificationModel
            .updateMany(
                { receiverId: memberId, notificationStatus: NotificationStatus.WAIT },
                { notificationStatus: NotificationStatus.READ },
            )
            .exec();
        return true;
    }
}
