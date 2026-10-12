import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Comment, Comments } from '../../libs/dto/comment/comment';
import { DoctorService } from '../doctor/doctor.service';
import { ClinicService } from '../clinic/clinic.service';
import { ArticleService } from '../article/article.service';
import { CommentInput, CommentsInquiry } from '../../libs/dto/comment/comment.input';
import { Direction, Message } from '../../libs/enums/common.enum';
import { CommentGroup, CommentStatus } from '../../libs/enums/comment.enum';
import { CommentUpdate } from '../../libs/dto/comment/comment.update';
import { T } from '../../libs/types/common';
import { lookupMember } from '../../libs/config';
import { NotificationService } from '../notification/notification.service';
import { NotificationGroup, NotificationType } from '../../libs/enums/notification.enum';

@Injectable()
export class CommentService {
    constructor (
        @InjectModel("Comment") private readonly commentModel: Model<Comment>,
        private doctorService: DoctorService,
        private clinicService: ClinicService,
        private articleService: ArticleService,
        private notificationService: NotificationService,
    ) {}

    public async createComment(memberId: ObjectId, input: CommentInput): Promise<Comment> {
        input.memberId = memberId;
        // a deleted article takes no new comments
        if (input.commentGroup === CommentGroup.ARTICLE && !(await this.articleService.isActiveArticle(input.commentRefId))) {
            throw new BadRequestException(Message.NO_DATA_FOUND);
        }

        let result: Comment | null = null;
        try { //@ts-ignore
            result = await this.commentModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        // owner of the commented target receives the notification
        const target = await this.commentStatsEditor(input.commentGroup, input.commentRefId, 1);
        if (!result) throw new InternalServerErrorException(Message.CREATE_FAILED);

        if (target) {
            await this.notificationService.createNotification({
                notificationType: NotificationType.COMMENT,
                notificationGroup: input.commentGroup as unknown as NotificationGroup,
                notificationTitle: "New comment",
                notificationDesc: input.commentContent,
                authorId: memberId,
                receiverId: target.memberId,
                notificationRefId: input.commentRefId,
                commentId: result._id,
                articleId: input.commentGroup === CommentGroup.ARTICLE ? input.commentRefId : undefined,
            });
        }
        return result;
    }

    public async updateComment(memberId: ObjectId, input: CommentUpdate): Promise<Comment> {
        const { _id, commentStatus } = input;
        // only admin can block comments
        if (commentStatus === CommentStatus.BLOCK) throw new BadRequestException(Message.NOT_ALLOWED_REQUEST);

        const result = await this.commentModel
            .findOneAndUpdate(
                { _id: _id, memberId: memberId, commentStatus: CommentStatus.ACTIVE },
                input, { new: true }
            );

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        // only ACTIVE comments are counted
        if (commentStatus === CommentStatus.DELETE) {
            await this.commentStatsEditor(result.commentGroup, result.commentRefId, -1);
            await this.notificationService.removeCommentNotifications([result._id]);
        }
        return result;
    }

    // keeps doctorComments / clinicComments / articleComments equal to the number of ACTIVE comments
    private async commentStatsEditor(group: CommentGroup, refId: ObjectId, modifier: number): Promise<{ memberId: ObjectId } | null> {
        switch (group) {
            case CommentGroup.DOCTOR:
                return await this.doctorService.doctorStatsEditor({ _id: refId, targetKey: "doctorComments", modifier: modifier });
            case CommentGroup.CLINIC:
                return await this.clinicService.clinicStatsEditor({ _id: refId, targetKey: "clinicComments", modifier: modifier });
            case CommentGroup.ARTICLE:
                return await this.articleService.articleStatsEditor({ _id: refId, targetKey: "articleComments", modifier: modifier });
            default:
                return null;
        }
    }

    public async getComments(memberId: ObjectId, input: CommentsInquiry): Promise<Comments> {
        const { commentRefId } = input.search;
        const match: T = { commentRefId: commentRefId, commentStatus: CommentStatus.ACTIVE };
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

        const result: Comments[] = await this.commentModel
            .aggregate([
                {$match: match},
                {$sort: sort},
                {
                    $facet: {
                        list: [
                            {$skip: (input.page - 1) * input.limit},
                            {$limit: input.limit},
                            lookupMember,
                            { $unwind: '$memberData'},
                        ],
                        metaCounter: [{$count: 'total'}],
                    },
                },
            ]);
        
        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);
        return result[0];
    }

    /** ADMIN **/

    public async updateCommentByAdmin(input: CommentUpdate): Promise<Comment> {
        // the document before the update tells whether it was counted
        const before = await this.commentModel.findOneAndUpdate({ _id: input._id }, input).exec();
        if (!before) throw new InternalServerErrorException(Message.UPDATE_FAILED);

        const wasActive = before.commentStatus === CommentStatus.ACTIVE;
        const isActive = (input.commentStatus ?? before.commentStatus) === CommentStatus.ACTIVE;
        if (wasActive !== isActive) await this.commentStatsEditor(before.commentGroup, before.commentRefId, isActive ? 1 : -1);
        if (!isActive) await this.notificationService.removeCommentNotifications([before._id]);

        return await this.commentModel.findById(input._id).exec() as unknown as Comment;
    }

    public async removeCommentByAdmin(input: ObjectId): Promise<Comment> {
        const result = await this.commentModel.findOneAndDelete({ _id: input });
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

        if (result.commentStatus === CommentStatus.ACTIVE) await this.commentStatsEditor(result.commentGroup, result.commentRefId, -1);
        await this.notificationService.removeCommentNotifications([result._id]);
        return result;
    }
}
