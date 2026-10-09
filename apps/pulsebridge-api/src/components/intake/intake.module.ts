import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { IntakeResolver } from './intake.resolver';
import { IntakeService } from './intake.service';
import IntakeSessionSchema from '../../schemas/IntakeSession.model';
import { AuthModule } from '../auth/auth.module';
import { DoctorModule } from '../doctor/doctor.module';
import { IntakeAiProvider } from '../../libs/ai/intake-ai.provider';
import { ClaudeIntakeProvider } from '../../libs/ai/claude-intake.provider';

@Module({
    imports: [
        MongooseModule.forFeature([{name: "IntakeSession", schema: IntakeSessionSchema}]),
        ConfigModule,
        AuthModule,
        DoctorModule,
    ],
    providers: [
        IntakeResolver,
        IntakeService,
        // swap the AI here (another provider, or a mock in tests)
        { provide: IntakeAiProvider, useClass: ClaudeIntakeProvider },
    ],
})
export class IntakeModule {}
