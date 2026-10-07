import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { FollowService } from './follow.service';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Follow, Follows } from '../../libs/dto/follow/follow';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { ObjectId } from 'mongoose';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { FollowersInquiry, FollowingsInquiry, FollowInput } from '../../libs/dto/follow/follow.input';
import { WithoutGuard } from '../auth/guards/without.guard';

@Resolver()
export class FollowResolver {
    constructor(private readonly followService: FollowService) { }


    @UseGuards(AuthGuard)
    @Mutation((returns) => Follow)
    public async subscribe(
        @Args("input") input: FollowInput,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Follow> {
        console.log("Mutation: subscribe");
        input.refId = shapeIntoMongoObjectId(input.refId);
        return await this.followService.subscribe(memberId, input);
    }

    @UseGuards(AuthGuard)
    @Mutation((returns) => Follow)
    public async unsubscribe(
        @Args("input") input: FollowInput,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Follow> {
        console.log("Mutation: unsubscribe");
        input.refId = shapeIntoMongoObjectId(input.refId);
        return await this.followService.unsubscribe(memberId, input);
    }

    @UseGuards(WithoutGuard)
    @Query((returns) => Follows)
    public async getMemberFollowings(
        @Args("input") input: FollowingsInquiry,
        @AuthMember('_id') memberId: ObjectId
    ): Promise<Follows> {
        console.log("Query: getMemberFollowings");
        input.search.followerId = shapeIntoMongoObjectId(input.search.followerId);
        return await this.followService.getMemberFollowings(memberId, input);
    }

    @UseGuards(WithoutGuard)
    @Query((returns) => Follows)
    public async getFollowers(@Args("input") input: FollowersInquiry): Promise<Follows> {
        console.log("Query: getFollowers");
        input.search.refId = shapeIntoMongoObjectId(input.search.refId);
        return await this.followService.getFollowers(input);
    }
}
