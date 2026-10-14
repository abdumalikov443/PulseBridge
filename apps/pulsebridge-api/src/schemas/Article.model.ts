import { Schema } from 'mongoose';
import { ArticleStatus } from '../libs/enums/article.enum';

const ArticleSchema = new Schema(
	{
		articleStatus: {
			type: String,
			enum: ArticleStatus,
			default: ArticleStatus.ACTIVE,
		},

		articleTitle: {
			type: String,
			required: true,
		},

		articleContent: {
			type: String,
			required: true,
		},

		articleImage: {
			type: String,
		},

		articleLikes: {
			type: Number,
			default: 0,
		},

		articleViews: {
			type: Number,
			default: 0,
		},

		articleComments: {
			type: Number,
			default: 0,
		},

		memberId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'Member',
		},
	},
	{ timestamps: true, collection: 'articles' },
);

// community lists (newest) and a member's articles
ArticleSchema.index({ articleStatus: 1, createdAt: -1 });
ArticleSchema.index({ memberId: 1, articleStatus: 1, createdAt: -1 });

export default ArticleSchema;
