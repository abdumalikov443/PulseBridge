import { DoctorSpecialty } from '../enums/doctor.enum';
import { IntakeUrgency } from '../enums/intake.enum';

export interface IntakeTurn {
	role: 'user' | 'assistant';
	content: string;
}

// what the assistant returns on every turn
export interface IntakeAssessment {
	reply: string; // shown to the patient, in the patient's language
	ready: boolean; // enough information to suggest a doctor
	specialty: DoctorSpecialty | null;
	urgency: IntakeUrgency;
	complaintSummary: string; // short complaint for appointmentReason, patient's language
}

// AI behind an interface: the Claude implementation can be swapped without touching the intake module
export abstract class IntakeAiProvider {
	abstract isEnabled(): boolean;
	abstract assess(history: IntakeTurn[]): Promise<IntakeAssessment>;
}
