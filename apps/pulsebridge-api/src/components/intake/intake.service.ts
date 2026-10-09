import { BadRequestException, Injectable, InternalServerErrorException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, ObjectId } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IntakeChatResult, IntakeSession } from '../../libs/dto/intake/intake';
import { IntakeChatInput } from '../../libs/dto/intake/intake.input';
import { DoctorsInquiry } from '../../libs/dto/doctor/doctor.input';
import { Doctors } from '../../libs/dto/doctor/doctor';
import { IntakeAiProvider, IntakeTurn } from '../../libs/ai/intake-ai.provider';
import { IntakeUrgency } from '../../libs/enums/intake.enum';
import { DoctorSpecialty } from '../../libs/enums/doctor.enum';
import { Direction, Message } from '../../libs/enums/common.enum';
import { T } from '../../libs/types/common';
import { getAppTimezone, zonedTimeToDate } from '../../libs/config';
import { DoctorService } from '../doctor/doctor.service';

export const INTAKE_MESSAGES_PER_SESSION = 20;
export const INTAKE_SESSIONS_PER_DAY = 5; // per guest IP / per member
const DEFAULT_AI_DAILY_LIMIT = 10; // conversations per day for the whole platform (AI_DAILY_LIMIT)
const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
const MEMBER_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const URGENCY_LEVEL = { [IntakeUrgency.ROUTINE]: 0, [IntakeUrgency.SOON]: 1, [IntakeUrgency.EMERGENCY]: 2 };

@Injectable()
export class IntakeService {
    constructor(
        @InjectModel("IntakeSession") private readonly intakeModel: Model<IntakeSession>,
        private readonly intakeAi: IntakeAiProvider,
        private readonly doctorService: DoctorService,
        private readonly configService: ConfigService,
    ) {}

    // one chat turn; guests (memberId null) are limited by IP
    public async chat(memberId: ObjectId | null, ip: string, input: IntakeChatInput): Promise<IntakeChatResult> {
        if (!this.intakeAi.isEnabled()) throw new ServiceUnavailableException(Message.AI_UNAVAILABLE);

        let session: T;
        if (input.sessionKey) {
            session = await this.getOwnSession(memberId, input.sessionKey) as T;
        } else {
            await this.checkNewSessionLimits(memberId, ip);
            session = {
                sessionKey: uuidv4(),
                memberId: memberId ?? null,
                ip: ip,
                messages: [],
                ready: false,
                specialty: null,
                urgency: IntakeUrgency.ROUTINE,
                complaintSummary: '',
                expiresAt: new Date(Date.now() + (memberId ? MEMBER_TTL_MS : GUEST_TTL_MS)),
            };
        }

        const userTurns = session.messages.filter((m: IntakeTurn) => m.role === 'user').length;
        if (userTurns >= INTAKE_MESSAGES_PER_SESSION) throw new BadRequestException(Message.INTAKE_MESSAGE_LIMIT);

        const history: IntakeTurn[] = [...session.messages.map((m: IntakeTurn) => ({ role: m.role, content: m.content })), { role: 'user', content: input.message }];
        // a failed AI call stores nothing, so it does not use up any limit
        const assessment = await this.intakeAi.assess(history);

        const update: T = {
            messages: [...history, { role: 'assistant', content: assessment.reply }],
            // the most serious urgency seen in the conversation is kept
            urgency: URGENCY_LEVEL[assessment.urgency] >= URGENCY_LEVEL[session.urgency as IntakeUrgency] ? assessment.urgency : session.urgency,
        };
        // once a doctor type is suggested it stays, a later turn can only refine it
        if (assessment.ready) Object.assign(update, { ready: true, specialty: assessment.specialty, complaintSummary: assessment.complaintSummary });

        const saved = session._id
            ? await this.intakeModel.findByIdAndUpdate(session._id, update, { new: true }).lean().exec()
            : (await this.intakeModel.create({ ...session, ...update })).toObject();
        if (!saved) throw new InternalServerErrorException(Message.SOMETHING_WENT_WRONG);

        return {
            sessionKey: saved.sessionKey as string,
            reply: assessment.reply,
            ready: saved.ready,
            specialty: saved.specialty,
            urgency: saved.urgency,
            complaintSummary: saved.complaintSummary,
            remainingMessages: INTAKE_MESSAGES_PER_SESSION - userTurns - 1,
        };
    }

    private async checkNewSessionLimits(memberId: ObjectId | null, ip: string): Promise<void> {
        const since = new Date(Date.now() - GUEST_TTL_MS);
        const mine = memberId
            ? await this.intakeModel.countDocuments({ memberId: memberId, createdAt: { $gte: since } }).exec()
            : await this.intakeModel.countDocuments({ ip: ip, memberId: null, createdAt: { $gte: since } }).exec();
        if (mine >= INTAKE_SESSIONS_PER_DAY) throw new BadRequestException(Message.INTAKE_SESSION_LIMIT);

        // platform budget: new conversations since midnight in the platform timezone
        const timeZone = getAppTimezone();
        const today = new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date());
        const todayCount = await this.intakeModel.countDocuments({ createdAt: { $gte: zonedTimeToDate(today, '00:00', timeZone) } }).exec();
        if (todayCount >= this.getDailyLimit()) throw new ServiceUnavailableException(Message.AI_DAILY_LIMIT);
    }

    private getDailyLimit(): number {
        const raw = this.configService.get<string>('AI_DAILY_LIMIT');
        const limit = Number(raw);
        return raw && Number.isFinite(limit) && limit >= 0 ? limit : DEFAULT_AI_DAILY_LIMIT;
    }

    // a session claimed by a member is visible only to that member; a guest session only by its key
    private async getOwnSession(memberId: ObjectId | null, sessionKey: string): Promise<IntakeSession> {
        const session = await this.intakeModel.findOne({ sessionKey: sessionKey }).lean().exec() as unknown as IntakeSession;
        if (!session || (session.memberId && String(session.memberId) !== String(memberId))) {
            throw new BadRequestException(Message.INTAKE_NOT_FOUND);
        }
        return session;
    }

    // after login: the guest conversation becomes the patient's and is kept 30 days
    public async claimSession(memberId: ObjectId, sessionKey: string): Promise<IntakeSession> {
        const result = await this.intakeModel
            .findOneAndUpdate(
                { sessionKey: sessionKey, $or: [{ memberId: null }, { memberId: memberId }] },
                { memberId: memberId, expiresAt: new Date(Date.now() + MEMBER_TTL_MS) },
                { new: true },
            )
            .lean()
            .exec();
        if (!result) throw new BadRequestException(Message.INTAKE_NOT_FOUND);
        return result as unknown as IntakeSession;
    }

    public async getSession(memberId: ObjectId, sessionKey: string): Promise<IntakeSession> {
        const session = await this.getOwnSession(memberId, sessionKey);
        if (!session.memberId) throw new BadRequestException(Message.INTAKE_NOT_FOUND);
        return session;
    }

    // doctors come from the database (never from the AI): public doctors of the suggested specialty, best ranked first
    public async getRecommendations(memberId: ObjectId, sessionKey: string): Promise<Doctors> {
        const session = await this.getSession(memberId, sessionKey);
        if (!session.ready || !session.specialty) throw new BadRequestException(Message.INTAKE_NOT_READY);

        const find = (specialty: DoctorSpecialty) => this.doctorService.getDoctors(memberId, {
            page: 1, limit: 5, sort: 'doctorRank', direction: Direction.DESC, search: { specialtyList: [specialty] },
        } as DoctorsInquiry);
        const result = await find(session.specialty);
        // nobody of that specialty yet: a general practitioner can still help
        if (!result.list.length && session.specialty !== DoctorSpecialty.GENERAL) return await find(DoctorSpecialty.GENERAL);
        return result;
    }
}
