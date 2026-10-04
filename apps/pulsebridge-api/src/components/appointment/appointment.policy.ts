import { AppointmentStatus } from '../../libs/enums/appointment.enum';
import { MemberType } from '../../libs/enums/member.enum';

// who is acting on the appointment: its patient, its doctor or the clinic owner
export type AppointmentActor = MemberType.PATIENT | MemberType.DOCTOR | MemberType.CLINIC;

/**
 * Only CONFIRMED appointments can change.
 * Patient can only cancel; doctor and clinic owner can complete or cancel.
 */
export const canChangeAppointmentStatus = (
	actor: AppointmentActor,
	current: AppointmentStatus,
	next: AppointmentStatus,
): boolean => {
	if (current !== AppointmentStatus.CONFIRMED) return false;
	if (actor === MemberType.PATIENT) return next === AppointmentStatus.CANCELLED;
	return next === AppointmentStatus.COMPLETED || next === AppointmentStatus.CANCELLED;
};
