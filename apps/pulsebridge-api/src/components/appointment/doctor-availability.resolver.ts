import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Doctor } from '../../libs/dto/doctor/doctor';
import { NextSlot } from '../../libs/dto/appointment/availability';
import { AppointmentService } from './appointment.service';

// Doctor.nextAvailable: computed only when a query asks for it (doctor cards),
// so a doctor list comes with its free slots in one request instead of one request per card
@Resolver(() => Doctor)
export class DoctorAvailabilityResolver {
    constructor(private readonly appointmentService: AppointmentService) {}

    @ResolveField(() => NextSlot, { nullable: true })
    public async nextAvailable(@Parent() doctor: Doctor): Promise<NextSlot | null> {
        return await this.appointmentService.getNextAvailable(doctor);
    }
}
