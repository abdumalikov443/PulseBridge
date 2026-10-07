import { BadRequestException, Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { isValidObjectId } from 'mongoose';
import { AppointmentService } from './appointment.service';
import { HttpAuthGuard } from '../auth/guards/http-auth.guard';
import { AuthMember } from '../auth/decorators/authMember.decorator';
import { Member } from '../../libs/dto/member/member';
import { Message } from '../../libs/enums/common.enum';
import { shapeIntoMongoObjectId } from '../../libs/config';
import { buildAppointmentPdf } from '../../libs/pdf/appointment-pdf';

// REST: GraphQL is not suited for binary files
@Controller('appointment')
export class AppointmentController {
    constructor(private readonly appointmentService: AppointmentService) {}

    // PDF built on request and streamed; nothing is stored on the server
    @UseGuards(HttpAuthGuard)
    @Get(':id/pdf')
    public async downloadPdf(
        @Param('id') id: string,
        @AuthMember() authMember: Member,
        @Res() res: Response
    ): Promise<void> {
        console.log("GET: appointment pdf");
        if (!isValidObjectId(id)) throw new BadRequestException(Message.BAD_REQUEST);
        const appointment = await this.appointmentService.getAppointmentDocument(authMember, shapeIntoMongoObjectId(id));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="appointment-${id}.pdf"`);
        res.setHeader('Cache-Control', 'no-store');
        const doc = buildAppointmentPdf(appointment);
        doc.pipe(res);
        doc.end();
    }
}
