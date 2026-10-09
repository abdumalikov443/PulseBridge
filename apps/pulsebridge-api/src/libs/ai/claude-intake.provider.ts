import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { IntakeAiProvider, IntakeAssessment, IntakeTurn } from './intake-ai.provider';
import { INTAKE_OUTPUT_SCHEMA, INTAKE_SYSTEM_PROMPT } from './intake.prompt';
import { DoctorSpecialty } from '../enums/doctor.enum';
import { IntakeUrgency } from '../enums/intake.enum';
import { Message } from '../enums/common.enum';

// cheapest current model: routing a complaint needs no deep reasoning
export const INTAKE_MODEL = 'claude-haiku-4-5';

// reply shown when the model declines (stop_reason "refusal")
const REFUSAL_ASSESSMENT: IntakeAssessment = {
	reply: 'I can not help with this request here. You can choose a general practitioner from the doctors list.',
	ready: false,
	specialty: null,
	urgency: IntakeUrgency.ROUTINE,
	complaintSummary: '',
};

// validates the JSON the model returned; unknown values fall back to safe defaults
export const parseIntakeAssessment = (text: string): IntakeAssessment => {
	const data = JSON.parse(text);
	const specialty = Object.values(DoctorSpecialty).includes(data.specialty) ? (data.specialty as DoctorSpecialty) : null;
	const urgency = Object.values(IntakeUrgency).includes(data.urgency) ? (data.urgency as IntakeUrgency) : IntakeUrgency.ROUTINE;
	const ready = data.ready === true && (specialty !== null || urgency === IntakeUrgency.EMERGENCY);
	return {
		reply: String(data.reply ?? '').trim().slice(0, 2000),
		ready: ready,
		// a ready conversation always names a doctor type; GENERAL when the model left it empty
		specialty: ready ? specialty ?? DoctorSpecialty.GENERAL : specialty,
		urgency: urgency,
		// appointmentReason accepts 3-500 characters
		complaintSummary: ready ? String(data.complaintSummary ?? '').trim().slice(0, 500) : '',
	};
};

@Injectable()
export class ClaudeIntakeProvider extends IntakeAiProvider {
	private client: Anthropic | null = null;

	constructor(private readonly configService: ConfigService) {
		super();
	}

	public isEnabled(): boolean {
		return !!this.configService.get<string>('ANTHROPIC_API_KEY');
	}

	// created on first use: the key is read after .env is loaded
	private getClient(): Anthropic {
		if (!this.client) this.client = new Anthropic({ apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'), maxRetries: 2, timeout: 30_000 });
		return this.client;
	}

	public async assess(history: IntakeTurn[]): Promise<IntakeAssessment> {
		if (!this.isEnabled()) throw new ServiceUnavailableException(Message.AI_UNAVAILABLE);

		let response: Anthropic.Message;
		try {
			response = await this.getClient().messages.create({
				model: INTAKE_MODEL,
				max_tokens: 1024,
				// automatic caching of the whole prefix (prompt + history): on Haiku 4.5 it starts once a
				// conversation passes 4096 tokens; shorter chats are simply not cached (no error)
				cache_control: { type: 'ephemeral' },
				system: INTAKE_SYSTEM_PROMPT,
				messages: history.map((turn): Anthropic.MessageParam => ({ role: turn.role, content: turn.content })),
				output_config: { format: { type: 'json_schema', schema: INTAKE_OUTPUT_SCHEMA } },
			});
		} catch (err) {
			// never log the conversation itself: it is health data
			if (err instanceof Anthropic.RateLimitError) console.log('Intake AI: rate limited');
			else if (err instanceof Anthropic.AuthenticationError) console.log('Intake AI: invalid ANTHROPIC_API_KEY');
			else if (err instanceof Anthropic.APIConnectionError) console.log('Intake AI: connection error');
			else if (err instanceof Anthropic.APIError) console.log(`Intake AI: API error ${err.status}`);
			else console.log('Intake AI: unexpected error');
			throw new ServiceUnavailableException(Message.AI_UNAVAILABLE);
		}

		if (response.stop_reason === 'refusal') return REFUSAL_ASSESSMENT;
		const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
		if (response.stop_reason === 'max_tokens' || !textBlock) throw new ServiceUnavailableException(Message.AI_UNAVAILABLE);
		try {
			return parseIntakeAssessment(textBlock.text);
		} catch {
			throw new ServiceUnavailableException(Message.AI_UNAVAILABLE);
		}
	}
}
