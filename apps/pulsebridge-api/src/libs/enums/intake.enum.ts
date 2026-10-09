import { registerEnumType } from '@nestjs/graphql';

// how soon the patient should see a doctor (not a diagnosis)
export enum IntakeUrgency {
	EMERGENCY = 'EMERGENCY', // call emergency services now
	SOON = 'SOON', // within a few days
	ROUTINE = 'ROUTINE',
}
registerEnumType(IntakeUrgency, {
	name: 'IntakeUrgency',
});
