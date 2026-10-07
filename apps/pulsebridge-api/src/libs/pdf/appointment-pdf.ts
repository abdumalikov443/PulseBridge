import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import moment from 'moment';
import { Appointment } from '../dto/appointment/appointment';
import { getAppTimezone } from '../config';
import { getWeekDay } from '../schedule';

// fonts are copied next to the build (nest-cli assets); during ts-node / tests they are read from src
const FONT_DIR = [path.join(__dirname, 'assets', 'fonts'), path.join(process.cwd(), 'apps', 'pulsebridge-api', 'src', 'assets', 'fonts')]
	.find((dir) => fs.existsSync(path.join(dir, 'NotoSans-Regular.ttf'))) as string;
const FONTS = {
	regular: path.join(FONT_DIR, 'NotoSans-Regular.ttf'), // latin + cyrillic (incl. uzbek)
	bold: path.join(FONT_DIR, 'NotoSans-Bold.ttf'),
	korean: path.join(FONT_DIR, 'NotoSansKR-Regular.otf'), // hangul, used only where Noto Sans has no glyph
};
// eslint-disable-next-line @typescript-eslint/no-var-requires
const latinFont = require('fontkit').openSync(FONTS.regular);

const GRAY = '#6b7280';
const DARK = '#111827';

// split text into runs: Noto Sans where it has the glyph, Noto Sans KR otherwise
const writeText = (doc: PDFKit.PDFDocument, text: string, font: 'regular' | 'bold', size: number, color: string) => {
	const runs: { korean: boolean; text: string }[] = [];
	for (const ch of text) {
		const korean = !latinFont.hasGlyphForCodePoint(ch.codePointAt(0));
		if (runs.length && runs[runs.length - 1].korean === korean) runs[runs.length - 1].text += ch;
		else runs.push({ korean, text: ch });
	}
	doc.fillColor(color).fontSize(size);
	runs.forEach((run, i) => doc.font(run.korean ? 'korean' : font).text(run.text, { continued: i < runs.length - 1 }));
};

const row = (doc: PDFKit.PDFDocument, label: string, value?: string | null) => {
	if (!value) return;
	writeText(doc, label, 'bold', 9, GRAY);
	writeText(doc, value, 'regular', 12, DARK);
	doc.moveDown(0.6);
};

const personName = (member?: { memberFullName?: string; memberNick?: string } | null) => member?.memberFullName || member?.memberNick || '-';

// short appointment document, built on request and streamed (never stored)
export const buildAppointmentPdf = (appointment: Appointment): PDFKit.PDFDocument => {
	const doc = new PDFDocument({ size: 'A5', margin: 40, info: { Title: `Appointment ${appointment._id}`, Author: 'PulseBridge' } });
	doc.registerFont('regular', FONTS.regular);
	doc.registerFont('bold', FONTS.bold);
	doc.registerFont('korean', FONTS.korean);

	const timeZone = getAppTimezone();
	const date = moment.utc(appointment.appointmentDate).format('YYYY-MM-DD');
	const doctor = appointment.doctorData;
	const clinic = appointment.clinicData;

	writeText(doc, 'PulseBridge', 'bold', 20, DARK);
	writeText(doc, 'Appointment', 'regular', 12, GRAY);
	doc.moveDown(0.5);
	doc.moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).strokeColor('#e5e7eb').stroke();
	doc.moveDown(0.8);

	row(doc, 'Appointment No.', String(appointment._id));
	row(doc, 'Date & time', `${date} (${getWeekDay(date)}) ${appointment.appointmentTime} · ${timeZone}`);
	row(doc, 'Patient', personName(appointment.memberData));
	row(doc, 'Doctor', doctor ? `${personName(doctor.memberData)} · ${doctor.specialty}` : null);
	row(doc, 'Clinic', clinic?.clinicName);
	row(doc, 'Address', clinic?.clinicAddress);
	row(doc, 'Reason', appointment.appointmentReason);

	doc.moveDown(0.5);
	const generatedAt = new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }).format(new Date());
	writeText(doc, `Generated ${generatedAt} (${timeZone})`, 'regular', 8, GRAY);
	return doc;
};
