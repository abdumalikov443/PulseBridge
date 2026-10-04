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

@Injectable()
export class CommentService {
    constructor (
        @InjectModel("Comment") private readonly commentModel: Model<Comment>,
        private doctorService: DoctorService,
        private clinicService: ClinicService,
        private articleService: ArticleService,
    ) {}

    public async createComment(memberId: ObjectId, input: CommentInput): Promise<Comment> {
        input.memberId = memberId;

        let result = null;
        try { //@ts-ignore
            result = await this.commentModel.create(input);
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }

        switch (input.commentGroup) {
            case CommentGroup.DOCTOR:
                await this.doctorService.doctorStatsEditor({
                    _id: input.commentRefId,
                    targetKey: "doctorComments",
                    modifier: 1
                });
                break;
            case CommentGroup.CLINIC:
                await this.clinicService.clinicStatsEditor({
                    _id: input.commentRefId,
                    targetKey: "clinicComments",
                    modifier: 1
                });
                break;
            case CommentGroup.ARTICLE:
                await this.articleService.articleStatsEditor({
                    _id: input.commentRefId,
                    targetKey: "articleComments",
                    modifier: 1
                });
                break;
        }
        if (!result) throw new InternalServerErrorException(Message.CREATE_FAILED);
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
        return result;
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
        const result = await this.commentModel
            .findOneAndUpdate({ _id: input._id }, input, { new: true })
            .exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);
        return result;
    }

    public async removeCommentByAdmin(input: ObjectId): Promise<Comment> {
        const result = await this.commentModel.findOneAndDelete({ _id: input });
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

        return result;
    }
}
