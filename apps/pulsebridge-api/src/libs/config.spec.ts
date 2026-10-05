import { getAppTimezone, zonedTimeToDate } from './config';

describe('zonedTimeToDate', () => {
	it('converts a wall-clock slot of the timezone to the real instant', () => {
		expect(zonedTimeToDate('2026-10-06', '14:00', 'Asia/Seoul').toISOString()).toBe('2026-10-06T05:00:00.000Z');
		expect(zonedTimeToDate('2026-10-06', '14:00', 'Asia/Tashkent').toISOString()).toBe('2026-10-06T09:00:00.000Z');
		expect(zonedTimeToDate('2026-10-06', '14:00', 'UTC').toISOString()).toBe('2026-10-06T14:00:00.000Z');
	});

	it('handles slots that fall on the previous UTC day', () => {
		expect(zonedTimeToDate('2026-10-06', '00:30', 'Asia/Seoul').toISOString()).toBe('2026-10-05T15:30:00.000Z');
	});
});

describe('getAppTimezone', () => {
	const saved = process.env.APP_TIMEZONE;
	afterEach(() => {
		if (saved === undefined) delete process.env.APP_TIMEZONE;
		else process.env.APP_TIMEZONE = saved;
	});

	it('defaults to Asia/Seoul and follows APP_TIMEZONE', () => {
		delete process.env.APP_TIMEZONE;
		expect(getAppTimezone()).toBe('Asia/Seoul');
		process.env.APP_TIMEZONE = 'Asia/Tashkent';
		expect(getAppTimezone()).toBe('Asia/Tashkent');
	});
});
