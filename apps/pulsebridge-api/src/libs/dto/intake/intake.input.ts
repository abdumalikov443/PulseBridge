import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsUUID, Length } from 'class-validator';

@InputType()
export class IntakeChatInput {
	// empty on the first message: a new session is started
	@IsOptional()
	@IsUUID(4)
	@Field(() => String, { nullable: true })
	sessionKey?: string;

	@IsNotEmpty()
	@Length(1, 1000)
	@Field(() => String)
	message: string;
}
