import { Field, Int, ObjectType } from '@nestjs/graphql';
import { ObjectId } from 'mongoose';
import { DoctorSpecialty } from '../../enums/doctor.enum';
import { IntakeUrgency } from '../../enums/intake.enum';

@ObjectType()
export class IntakeMessage {
	// "user" | "assistant"
	@Field(() => String)
	role: string;

	@Field(() => String)
	content: string;
}

@ObjectType()
export class IntakeSession {
	@Field(() => String)
	_id: ObjectId;

	@Field(() => String, { nullable: true })
	memberId?: ObjectId | null;

	@Field(() => [IntakeMessage])
	messages: IntakeMessage[];

	@Field(() => Boolean)
	ready: boolean;

	@Field(() => DoctorSpecialty, { nullable: true })
	specialty?: DoctorSpecialty | null;

	@Field(() => IntakeUrgency)
	urgency: IntakeUrgency;

	// prefill for the booking form's reason (the patient can edit it)
	@Field(() => String)
	complaintSummary: string;

	@Field(() => Date)
	expiresAt: Date;

	@Field(() => Date)
	createdAt: Date;

	sessionKey?: string;
	ip?: string;
}

// one chat turn
@ObjectType()
export class IntakeChatResult {
	// keep it on the client and send it with every next message (and to claim the session after login)
	@Field(() => String)
	sessionKey: string;

	@Field(() => String)
	reply: string;

	// true: show "connect with a doctor"
	@Field(() => Boolean)
	ready: boolean;

	@Field(() => DoctorSpecialty, { nullable: true })
	specialty?: DoctorSpecialty | null;

	// EMERGENCY: show the emergency call banner
	@Field(() => IntakeUrgency)
	urgency: IntakeUrgency;

	@Field(() => String)
	complaintSummary: string;

	@Field(() => Int)
	remainingMessages: number;
}
