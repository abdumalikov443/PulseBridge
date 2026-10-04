import { canChangeAppointmentStatus } from './appointment.policy';
import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberType } from '../../libs/enums/member.enum';

const { CONFIRMED, COMPLETED, CANCELLED } = AppointmentStatus;

describe('canChangeAppointmentStatus', () => {
	it('patient can only cancel a confirmed appointment', () => {
		expect(canChangeAppointmentStatus(MemberType.PATIENT, CONFIRMED, CANCELLED)).toBe(true);
		expect(canChangeAppointmentStatus(MemberType.PATIENT, CONFIRMED, COMPLETED)).toBe(false);
	});

	it('doctor and clinic owner can complete or cancel a confirmed appointment', () => {
		for (const actor of [MemberType.DOCTOR, MemberType.CLINIC] as const) {
			expect(canChangeAppointmentStatus(actor, CONFIRMED, COMPLETED)).toBe(true);
			expect(canChangeAppointmentStatus(actor, CONFIRMED, CANCELLED)).toBe(true);
		}
	});

	it('nobody can change a completed or cancelled appointment', () => {
		for (const actor of [MemberType.PATIENT, MemberType.DOCTOR, MemberType.CLINIC] as const) {
			for (const current of [COMPLETED, CANCELLED]) {
				expect(canChangeAppointmentStatus(actor, current, CANCELLED)).toBe(false);
				expect(canChangeAppointmentStatus(actor, current, COMPLETED)).toBe(false);
			}
		}
	});

	it('cannot move back to confirmed', () => {
		expect(canChangeAppointmentStatus(MemberType.DOCTOR, CONFIRMED, CONFIRMED)).toBe(false);
	});
});
