import { WeekDay } from './enums/clinic.enum';
import { getAppTimezone } from './config';

/** CLINIC SCHEDULE / APPOINTMENT SLOTS **/

export const SLOT_MINUTES = 30;
// bookable days: from tomorrow, this many days
export const AVAILABILITY_DAYS = 5;
// "HH:mm" on a half hour
export const HALF_HOUR_TIME = /^([01]\d|2[0-3]):(00|30)$/;

export interface ClinicSchedule {
	clinicOpenTime: string;
	clinicCloseTime: string;
	clinicBreakStart?: string | null;
	clinicBreakEnd?: string | null;
	clinicOffDays: WeekDay[];
}

export const DEFAULT_SCHEDULE: ClinicSchedule = {
	clinicOpenTime: '09:00',
	clinicCloseTime: '18:00',
	clinicBreakStart: null,
	clinicBreakEnd: null,
	clinicOffDays: [],
};

// clinics saved before the schedule existed have no schedule fields
export const withScheduleDefaults = (clinic: Partial<ClinicSchedule> | null | undefined): ClinicSchedule => ({
	clinicOpenTime: clinic?.clinicOpenTime ?? DEFAULT_SCHEDULE.clinicOpenTime,
	clinicCloseTime: clinic?.clinicCloseTime ?? DEFAULT_SCHEDULE.clinicCloseTime,
	clinicBreakStart: clinic?.clinicBreakStart ?? null,
	clinicBreakEnd: clinic?.clinicBreakEnd ?? null,
	clinicOffDays: clinic?.clinicOffDays ?? [],
});

const toMinutes = (time: string): number => {
	const [h, m] = time.split(':').map(Number);
	return h * 60 + m;
};

const toTime = (minutes: number): string =>
	`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

// open < close; break is both-or-none and inside the working hours
export const isValidSchedule = (s: ClinicSchedule): boolean => {
	const times = [s.clinicOpenTime, s.clinicCloseTime, s.clinicBreakStart, s.clinicBreakEnd].filter((t) => t);
	if (!times.every((t) => HALF_HOUR_TIME.test(t as string))) return false;
	if (toMinutes(s.clinicOpenTime) >= toMinutes(s.clinicCloseTime)) return false;
	if (!s.clinicBreakStart !== !s.clinicBreakEnd) return false;
	if (s.clinicBreakStart && s.clinicBreakEnd) {
		const [bs, be] = [toMinutes(s.clinicBreakStart), toMinutes(s.clinicBreakEnd)];
		if (bs >= be || bs < toMinutes(s.clinicOpenTime) || be > toMinutes(s.clinicCloseTime)) return false;
	}
	return s.clinicOffDays.length < 7;
};

// start times of the 30-minute slots in a working day, without the break
export const getScheduleSlots = (s: ClinicSchedule): string[] => {
	const slots: string[] = [];
	const breakStart = s.clinicBreakStart ? toMinutes(s.clinicBreakStart) : -1;
	const breakEnd = s.clinicBreakEnd ? toMinutes(s.clinicBreakEnd) : -1;
	for (let t = toMinutes(s.clinicOpenTime); t + SLOT_MINUTES <= toMinutes(s.clinicCloseTime); t += SLOT_MINUTES) {
		if (t >= breakStart && t < breakEnd) continue;
		slots.push(toTime(t));
	}
	return slots;
};

const WEEK_DAYS = [WeekDay.SUN, WeekDay.MON, WeekDay.TUE, WeekDay.WED, WeekDay.THU, WeekDay.FRI, WeekDay.SAT];

// "YYYY-MM-DD" is a calendar day, so its weekday does not depend on any timezone
export const getWeekDay = (date: string): WeekDay => WEEK_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

export const isOpenDay = (s: ClinicSchedule, date: string): boolean => !s.clinicOffDays.includes(getWeekDay(date));

// tomorrow .. +AVAILABILITY_DAYS as "YYYY-MM-DD" in the platform timezone
export const getBookableDates = (now: Date = new Date(), timeZone: string = getAppTimezone()): string[] => {
	const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
	const base = new Date(`${today}T00:00:00Z`).getTime();
	return Array.from({ length: AVAILABILITY_DAYS }, (_, i) => new Date(base + (i + 1) * 86400000).toISOString().slice(0, 10));
};
