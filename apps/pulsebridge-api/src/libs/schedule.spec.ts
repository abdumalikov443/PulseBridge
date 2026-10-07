import { DEFAULT_SCHEDULE, getBookableDates, getScheduleSlots, getWeekDay, isOpenDay, isValidSchedule, withScheduleDefaults } from './schedule';
import { WeekDay } from './enums/clinic.enum';

describe('clinic schedule', () => {
	const withBreak = { ...DEFAULT_SCHEDULE, clinicBreakStart: '13:00', clinicBreakEnd: '14:00', clinicOffDays: [WeekDay.SUN] };

	it('makes 30-minute slots inside working hours, without the break', () => {
		const slots = getScheduleSlots(withBreak);
		expect(slots[0]).toBe('09:00');
		expect(slots[slots.length - 1]).toBe('17:30');
		expect(slots).not.toContain('13:00');
		expect(slots).not.toContain('13:30');
		expect(slots).toContain('14:00');
		expect(slots).not.toContain('18:00');
		expect(slots.length).toBe(16);
	});

	it('validates schedules', () => {
		expect(isValidSchedule(DEFAULT_SCHEDULE)).toBe(true);
		expect(isValidSchedule(withBreak)).toBe(true);
		expect(isValidSchedule({ ...DEFAULT_SCHEDULE, clinicOpenTime: '18:00', clinicCloseTime: '09:00' })).toBe(false);
		expect(isValidSchedule({ ...DEFAULT_SCHEDULE, clinicOpenTime: '09:15' })).toBe(false);
		expect(isValidSchedule({ ...DEFAULT_SCHEDULE, clinicBreakStart: '13:00' })).toBe(false);
		expect(isValidSchedule({ ...DEFAULT_SCHEDULE, clinicBreakStart: '08:00', clinicBreakEnd: '09:00' })).toBe(false);
		expect(isValidSchedule({ ...DEFAULT_SCHEDULE, clinicOffDays: Object.values(WeekDay) })).toBe(false);
	});

	it('knows the weekday of a calendar date and the days off', () => {
		expect(getWeekDay('2026-10-13')).toBe(WeekDay.TUE);
		expect(getWeekDay('2026-10-18')).toBe(WeekDay.SUN);
		expect(isOpenDay(withBreak, '2026-10-18')).toBe(false);
		expect(isOpenDay(withBreak, '2026-10-13')).toBe(true);
	});

	it('lists 5 bookable days from tomorrow in the platform timezone', () => {
		// 2026-10-12 23:30 in Seoul (14:30 UTC): tomorrow in Seoul is the 13th
		expect(getBookableDates(new Date('2026-10-12T14:30:00Z'), 'Asia/Seoul')).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']);
		// same instant in Tashkent is still the 12th, 19:30
		expect(getBookableDates(new Date('2026-10-12T14:30:00Z'), 'Asia/Tashkent')[0]).toBe('2026-10-13');
		expect(getBookableDates(new Date('2026-10-12T15:30:00Z'), 'Asia/Seoul')[0]).toBe('2026-10-14');
	});

	it('fills defaults for clinics saved before the schedule existed', () => {
		expect(withScheduleDefaults({})).toEqual(DEFAULT_SCHEDULE);
	});
});
