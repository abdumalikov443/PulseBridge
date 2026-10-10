import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, Length } from 'class-validator';
import { ObjectId } from 'mongoose';
import { FaqTopic, NoticeStatus } from '../../enums/notice.enum';

// noticeCategory cannot be changed
@InputType()
export class NoticeUpdate {
	@IsNotEmpty()
	@Field(() => String)
	_id: ObjectId;

	@IsOptional()
	@Field(() => NoticeStatus, { nullable: true })
	noticeStatus?: NoticeStatus;

	@IsOptional()
	@Field(() => FaqTopic, { nullable: true })
	faqTopic?: FaqTopic;

	@IsOptional()
	@Length(3, 100)
	@Field(() => String, { nullable: true })
	noticeTitle?: string;

	@IsOptional()
	@Length(3, 2000)
	@Field(() => String, { nullable: true })
	noticeContent?: string;

	@IsOptional()
	@Field(() => Boolean, { nullable: true })
	noticePinned?: boolean;
}
