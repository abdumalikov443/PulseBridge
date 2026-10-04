import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ObjectId } from 'mongoose';
import { Article, Articles } from '../../libs/dto/article/article';
import { AllArticlesInquiry, ArticleInput, ArticlesInquiry } from '../../libs/dto/article/article.input';
import { MemberService } from '../member/member.service';
import { ViewService } from '../view/view.service';
import { Direction, Message } from '../../libs/enums/common.enum';
import { StatisticModifier, T } from '../../libs/types/common';
import { ArticleStatus } from '../../libs/enums/article.enum';
import { ViewGroup } from '../../libs/enums/view.enum';
import { ArticleUpdate } from '../../libs/dto/article/article.update';
import { lookupAuthMemberLiked, lookupMember, shapeIntoMongoObjectId } from '../../libs/config';
import { LikeInput } from '../../libs/dto/like/like.input';
import { LikeGroup } from '../../libs/enums/like.enum';
import { LikeService } from '../like/like.service';

@Injectable()
export class ArticleService {
    constructor (
        @InjectModel("Article") private readonly articleModel: Model<Article>,
        private memberService: MemberService,
        private viewService: ViewService,
        private likeService: LikeService
    ) {}

    public async createArticle(memberId: ObjectId, input: ArticleInput): Promise<Article> {
        input.memberId = memberId;
        try {
            const result = await this.articleModel.create(input);

            await this.memberService.memberStatsEditor({
                _id: result.memberId,
                targetKey: "memberArticles",
                modifier: 1
            });
            return result;
        } catch (err) {
            console.log("Error, Service.model: ", err.message);
            throw new BadRequestException(Message.CREATE_FAILED);
        }
    }

    public async getArticle(memberId: ObjectId, articleId: ObjectId): Promise<Article> {
        const search: T = {
            _id: articleId,
            articleStatus: ArticleStatus.ACTIVE
        };
        //@ts-ignore
        const targetArticle: Article = await this.articleModel.findOne(search).lean().exec();
        if (!targetArticle) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        if (memberId) {
            const viewInput = { memberId: memberId, viewRefId: articleId, viewGroup: ViewGroup.ARTICLE};
            const newView = await this.viewService.recordView(viewInput);
            if (newView) {
                await this.articleStatsEditor({ _id: articleId, targetKey: 'articleViews', modifier: 1 });
                targetArticle.articleViews++;
            }
            const likeInput = {memberId: memberId, likeRefId: articleId, likeGroup: LikeGroup.ARTICLE};
            targetArticle.meLiked = await this.likeService.checkLikeExistence(likeInput);
        }
        //@ts-ignore
        targetArticle.memberData = await this.memberService.getMember(null, targetArticle.memberId);
        return targetArticle;
    }

    public async updateArticle(memberId: ObjectId, input: ArticleUpdate): Promise<Article> {
        const { _id, articleStatus } = input;

        const result = await this.articleModel
            .findOneAndUpdate(
                { _id: _id, memberId: memberId, articleStatus: ArticleStatus.ACTIVE },
                input, { new: true }
            ).exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

        if (articleStatus === ArticleStatus.DELETE) {
            await this.memberService.memberStatsEditor({
                _id: memberId,
                targetKey: 'memberArticles',
                modifier: -1
            });
        }

        return result;
    }

    public async getArticles(memberId: ObjectId, input: ArticlesInquiry): Promise<Articles> {
        const { text } = input.search;
        const match: T = { articleStatus: ArticleStatus.ACTIVE };
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

        if (text) match.articleTitle = { $regex: new RegExp(text, 'i') };
        if (input.search?.memberId) {
            match.memberId = shapeIntoMongoObjectId(input.search.memberId);
        }
        console.log("match: ", match);

        const result = await this.articleModel
            .aggregate([
                {$match: match},
                {$sort: sort},
                {
                    $facet: {
                        list: [
                            {$skip: (input.page - 1) * input.limit},
                            {$limit: input.limit},
                            lookupAuthMemberLiked(memberId),
                            lookupMember,
                            { $unwind: '$memberData'},
                        ],
                        metaCounter: [{$count: 'total'}],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        return result[0];
    }

    public async likeTargetArticle(memberId: ObjectId, likeRefId: ObjectId): Promise<Article> {
        const target: Article = await this.articleModel.findOne({_id: likeRefId, articleStatus: ArticleStatus.ACTIVE}).exec() as unknown as Article;
        if (!target) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        const input: LikeInput = {
            memberId: memberId,
            likeRefId: likeRefId,
            likeGroup: LikeGroup.ARTICLE
        };

        const modifier: number = await this.likeService.toggleLike(input);
        const result = await this.articleStatsEditor({
            _id: likeRefId,
            targetKey: "articleLikes",
            modifier: modifier
        });

        if (!result) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);
        return result;
    }

    /** ADMIN **/

    public async getAllArticlesByAdmin(input: AllArticlesInquiry): Promise<Articles> {
        const { articleStatus } = input.search;
        const match: T = {};
        const sort: T = { [input?.sort ?? 'createdAt'] : input?.direction ?? Direction.DESC };

        if (articleStatus) match.articleStatus = articleStatus;

        const result = await this.articleModel
            .aggregate([
                { $match: match },
                { $sort: sort },
                {
                    $facet: {
                        list: [
                            { $skip: (input.page - 1) * input.limit },
                            { $limit: input.limit },
                            lookupMember,
                            { $unwind: '$memberData' },
                        ],
                        metaCounter: [{ $count: 'total' }],
                    },
                },
            ])
            .exec();

        if (!result.length) throw new InternalServerErrorException(Message.NO_DATA_FOUND);

        return result[0];
    }

    public async updateArticleByAdmin(input: ArticleUpdate): Promise<Article> {
        let { _id, articleStatus } = input;

        const result = await this.articleModel
            .findOneAndUpdate(
                { _id: _id, articleStatus: ArticleStatus.ACTIVE },
                input, { new: true }
            ).exec();

        if (!result) throw new InternalServerErrorException(Message.UPDATE_FAILED);

        if (articleStatus === ArticleStatus.DELETE) {
            await this.memberService.memberStatsEditor({
                _id: result.memberId,
                targetKey: 'memberArticles',
                modifier: -1
            });
        }

        return result;
    }

    public async removeArticleByAdmin(articleId: ObjectId): Promise<Article> {
        const search: T = {
            _id: articleId,
            articleStatus: ArticleStatus.DELETE
        };
        const result = await this.articleModel.findOneAndDelete(search).exec();
        if (!result) throw new InternalServerErrorException(Message.REMOVE_FAILED);

        return result;
    }

    public async articleStatsEditor(input: StatisticModifier): Promise<Article> {
        const { _id, targetKey, modifier } = input;
        return await this.articleModel
            .findByIdAndUpdate(_id, { $inc: { [targetKey]: modifier } }, { new: true })
            .exec() as unknown as Article;
    }
}
