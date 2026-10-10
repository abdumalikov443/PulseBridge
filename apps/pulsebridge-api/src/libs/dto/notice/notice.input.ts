import { Field, InputType, Int } from '@nestjs/graphql';
import { IsIn, IsNotEmpty, IsOptional, Length, Min } from 'class-validator';
import { ObjectId } from 'mongoose';
import { FaqTopic, NoticeCategory, NoticeStatus } from '../../enums/notice.enum';
import { Direction } from '../../enums/common.enum';
import { availableNoticeSorts } from '../../config';

@InputType()
export class NoticeInput {
	@IsNotEmpty()
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	// required for FAQ, not allowed for NOTICE
	@IsOptional()
	@Field(() => FaqTopic, { nullable: true })
	faqTopic?: FaqTopic;

	@IsNotEmpty()
	@Length(3, 100)
	@Field(() => String)
	noticeTitle: string;

	@IsNotEmpty()
	@Length(3, 2000)
	@Field(() => String)
	noticeContent: string;

	// HOLD keeps it as a draft
	@IsOptional()
	@IsIn([NoticeStatus.HOLD, NoticeStatus.ACTIVE])
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsOptional()
	@Field(() => Boolean, { nullable: true })
	noticePinned?: boolean;

	memberId?: ObjectId;
}

@InputType()
class NISearch {
	@IsNotEmpty()
	@Field(() => NoticeCategory)
	noticeCategory: NoticeCategory;

	@IsOptional()
	@Field(() => FaqTopic, { nullable: true })
	faqTopic?: FaqTopic;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

// public list: only ACTIVE, pinned first then newest
@InputType()
export class NoticesInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsNotEmpty()
	@Field(() => NISearch)
	search: NISearch;
}

@InputType()
class ANISearch {
	@IsOptional()
	@Field(() => NoticeCategory, { nullable: true })
	noticeCategory?: NoticeCategory;

	@IsOptional()
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsOptional()
	@Field(() => FaqTopic, { nullable: true })
	faqTopic?: FaqTopic;

	@IsOptional()
	@Field(() => String, { nullable: true })
	text?: string;
}

@InputType()
export class AllNoticesInquiry {
	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	page: number;

	@IsNotEmpty()
	@Min(1)
	@Field(() => Int)
	limit: number;

	@IsOptional()
	@IsIn(availableNoticeSorts)
	@Field(() => String, { nullable: true })
	sort?: string;

	@IsOptional()
	@Field(() => Direction, { nullable: true })
	direction?: Direction;

	@IsNotEmpty()
	@Field(() => ANISearch)
	search: ANISearch;
}
