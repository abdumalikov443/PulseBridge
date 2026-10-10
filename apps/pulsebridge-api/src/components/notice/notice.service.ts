import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Notice, Notices } from '../../libs/dto/notice/notice';
import { AllNoticesInquiry, NoticeInput, NoticesInquiry } from '../../libs/dto/notice/notice.input';
import { NoticeUpdate } from '../../libs/dto/notice/notice.update';
import { NoticeCategory, NoticeStatus } from '../../libs/enums/notice.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { lookupMember, shapeIntoSearchRegex } from '../../libs/config';

@Injectable()
export class NoticeService {
    constructor(@InjectModel("Notice") private readonly noticeModel: Model<Notice>) {}

    public async getNotice(noticeId: ObjectId): Promise<Notice> {
        const result = await this.noticeModel.findOne({ _id: noticeId, noticeStatus: NoticeStatus.ACTIVE }).exec();
        if (!result) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result;
    }

    // only ACTIVE; pinned first, then newest
    public async getNotices(input: NoticesInquiry): Promise<Notices> {
        const { noticeCategory, faqTopic, text } = input.search;
        const match: T = { noticeCategory: noticeCategory, noticeStatus: NoticeStatus.ACTIVE };
        if (faqTopic) match.faqTopic = faqTopic;
        if (text) match.noticeTitle = { $regex: shapeIntoSearchRegex(text) };

        const result = await this.noticeModel
            .aggregate([
                { $match: match },
                { $sort: { noticePinned: -1, createdAt: -1 } },
                {
                    $facet: {
                        list: [{ $skip: (input.page - 1) * input.limit }, { $limit: input.limit }],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    /** ADMIN **/

    public async createNotice(memberId: ObjectId, input: NoticeInput): Promise<Notice> {
        if (input.noticeCategory === NoticeCategory.FAQ && !input.faqTopic) throw new BadRequestException(Message.FAQ_TOPIC_REQUIRED);
        if (input.noticeCategory !== NoticeCategory.FAQ && input.faqTopic) throw new BadRequestException(Message.FAQ_TOPIC_ONLY_FOR_FAQ);
        input.memberId = memberId;
        try {
            return await this.noticeModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }
    }

    public async getAllNoticesByAdmin(input: AllNoticesInquiry): Promise<Notices> {
        const { noticeCategory, noticeStatus, faqTopic, text } = input.search;
        const match: T = {};
        const sort: T = { [input?.sort ?? 'createdAt']: input?.direction ?? Direction.DESC };

        if (noticeCategory) match.noticeCategory = noticeCategory;
        if (noticeStatus) match.noticeStatus = noticeStatus;
        if (faqTopic) match.faqTopic = faqTopic;
        if (text) match.noticeTitle = { $regex: shapeIntoSearchRegex(text) };

        const result = await this.noticeModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            lookupMember,
                            { $unwind: { path: '$memberData', preserveNullAndEmptyArrays: true } },
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    // text, topic, pin or status (HOLD hides, DELETE also unpins); category stays
    public async updateNotice(input: NoticeUpdate): Promise<Notice> {
        const target = await this.noticeModel.findById(input._id).exec();
        if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        if (input.faqTopic && target.noticeCategory !== NoticeCategory.FAQ) throw new BadRequestException(Message.FAQ_TOPIC_ONLY_FOR_FAQ);

        const update: T = { ...input };
        if (input.noticeStatus === NoticeStatus.DELETE) update.noticePinned = false;

        const result = await this.noticeModel.findByIdAndUpdate(input._id, update, { new: true }).exec();
        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    // permanent delete, only after it was set to DELETE
    public async removeNotice(noticeId: ObjectId): Promise<Notice> {
        const result = await this.noticeModel.findOneAndDelete({ _id: noticeId, noticeStatus: NoticeStatus.DELETE }).exec();
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);
        return result;
    }
}
