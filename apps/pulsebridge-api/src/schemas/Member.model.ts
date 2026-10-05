import { mongo, Schema } from 'mongoose';
import { MemberStatus, MemberType } from '../libs/enums/member.enum';

const MemberSchema = new Schema({
    memberType: {
        type: String,
        enum: MemberType,
        default: MemberType.PATIENT,
    },

    memberStatus: {
        type: String,
        enum: MemberStatus,
        default: MemberStatus.ACTIVE,
    },

    memberPhone: {
        type: String,
        index: { unique: true, sparse: true },
        required: true,
    },

    memberNick: {
        type: String,
        index: { unique: true, sparse: true },
        required: true,
    },

    memberPassword: {
        type: String,
        select: false,
        required: true,
    },

    memberFullName: {
        type: String,
    },

    memberImage: {
        type: String,
        default: "",
    },

    memberAddress: {
        type: String,
    },

    memberDesc: {
        type: String,
    },

    memberArticles: {
        type: Number,
        default: 0,
    },

    memberFollowers: {
        type: Number,
        default: 0,
    },

    memberFollowings: {
        type: Number,
        default: 0,
    },

    memberPoints: {
        type: Number,
        default: 0,
    },

    memberLikes: {
        type: Number,
        default: 0,
    },

    memberViews: {
        type: Number,
        default: 0,
    },

    memberComments: {
        type: Number,
        default: 0,
    },

    memberRank: {
        type: Number,
        default: 0,
    },

    deletedAt: {
        type: Date,
    }
},
    {timestamps: true, collection: 'members'},
);

// only one ADMIN in the whole platform
MemberSchema.index({ memberType: 1 }, { unique: true, partialFilterExpression: { memberType: MemberType.ADMIN } });

export default MemberSchema;