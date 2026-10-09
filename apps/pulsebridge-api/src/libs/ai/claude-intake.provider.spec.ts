import { ServiceUnavailableException } from '@nestjs/common';
import { ClaudeIntakeProvider, INTAKE_MODEL, parseIntakeAssessment } from './claude-intake.provider';
import { INTAKE_OUTPUT_SCHEMA } from './intake.prompt';
import { DoctorSpecialty } from '../enums/doctor.enum';
import { IntakeUrgency } from '../enums/intake.enum';

const json = (o: object) => JSON.stringify(o);

describe('parseIntakeAssessment', () => {
	it('keeps a valid ready assessment', () => {
		const a = parseIntakeAssessment(json({ reply: 'Nevrolog bilan ko‘rishing.', ready: true, specialty: 'NEUROLOGY', urgency: 'SOON', complaintSummary: '3 kundan beri bosh og‘rig‘i.' }));
		expect(a).toEqual({ reply: 'Nevrolog bilan ko‘rishing.', ready: true, specialty: DoctorSpecialty.NEUROLOGY, urgency: IntakeUrgency.SOON, complaintSummary: '3 kundan beri bosh og‘rig‘i.' });
	});

	it('not ready: no summary', () => {
		const a = parseIntakeAssessment(json({ reply: 'Qachondan beri?', ready: false, specialty: null, urgency: 'ROUTINE', complaintSummary: 'should be dropped' }));
		expect(a.ready).toBe(false);
		expect(a.complaintSummary).toBe('');
	});

	it('unknown specialty / urgency fall back to safe values', () => {
		const a = parseIntakeAssessment(json({ reply: 'x', ready: true, specialty: 'ASTROLOGY', urgency: 'WHENEVER', complaintSummary: 'pain' }));
		expect(a.specialty).toBe(null);
		expect(a.ready).toBe(false); // ready needs a known doctor type
		expect(a.urgency).toBe(IntakeUrgency.ROUTINE);
	});

	it('EMERGENCY is ready even without a specialty, routed to GENERAL', () => {
		const a = parseIntakeAssessment(json({ reply: 'Call 103 now.', ready: true, specialty: null, urgency: 'EMERGENCY', complaintSummary: 'Chest pain' }));
		expect(a.ready).toBe(true);
		expect(a.specialty).toBe(DoctorSpecialty.GENERAL);
		expect(a.urgency).toBe(IntakeUrgency.EMERGENCY);
	});

	it('cuts the summary to the 500 characters appointmentReason accepts', () => {
		const a = parseIntakeAssessment(json({ reply: 'x', ready: true, specialty: 'GENERAL', urgency: 'ROUTINE', complaintSummary: 'a'.repeat(900) }));
		expect(a.complaintSummary.length).toBe(500);
	});

	it('invalid JSON throws', () => {
		expect(() => parseIntakeAssessment('not json')).toThrow();
	});
});

describe('ClaudeIntakeProvider', () => {
	const config = (key?: string) => ({ get: (name: string) => (name === 'ANTHROPIC_API_KEY' ? key : undefined) }) as any;
	const withFakeClient = (response: object) => {
		const provider = new ClaudeIntakeProvider(config('test-key'));
		const create = jest.fn().mockResolvedValue(response);
		(provider as any).client = { messages: { create } };
		return { provider, create };
	};
	const history = [{ role: 'user' as const, content: 'Tishim og‘riyapti' }];

	it('is disabled without ANTHROPIC_API_KEY and does not call the API', async () => {
		const provider = new ClaudeIntakeProvider(config(undefined));
		expect(provider.isEnabled()).toBe(false);
		await expect(provider.assess(history)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it('sends Haiku 4.5, automatic caching and the JSON schema; parses the answer', async () => {
		const answer = { reply: 'Stomatolog kerak.', ready: true, specialty: 'DENTISTRY', urgency: 'SOON', complaintSummary: 'Tish og‘rig‘i.' };
		const { provider, create } = withFakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: json(answer) }] });
		const result = await provider.assess(history);

		expect(result.specialty).toBe(DoctorSpecialty.DENTISTRY);
		const params = create.mock.calls[0][0];
		expect(params.model).toBe(INTAKE_MODEL);
		expect(INTAKE_MODEL).toBe('claude-haiku-4-5');
		expect(params.cache_control).toEqual({ type: 'ephemeral' });
		expect(params.system).toContain('patient intake assistant');
		expect(params.output_config).toEqual({ format: { type: 'json_schema', schema: INTAKE_OUTPUT_SCHEMA } });
		expect(params.thinking).toBeUndefined(); // routing needs no thinking
		expect(params.messages).toEqual([{ role: 'user', content: 'Tishim og‘riyapti' }]);
	});

	it('refusal → safe reply, not ready', async () => {
		const { provider } = withFakeClient({ stop_reason: 'refusal', content: [] });
		const result = await provider.assess(history);
		expect(result.ready).toBe(false);
		expect(result.specialty).toBe(null);
	});

	it('cut-off answer (max_tokens) → unavailable', async () => {
		const { provider } = withFakeClient({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"reply": "Sto' }] });
		await expect(provider.assess(history)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});

	it('API errors → unavailable (no conversation text in the error)', async () => {
		const provider = new ClaudeIntakeProvider(config('test-key'));
		(provider as any).client = { messages: { create: jest.fn().mockRejectedValue(new Error('network down')) } };
		await expect(provider.assess(history)).rejects.toBeInstanceOf(ServiceUnavailableException);
	});
});
