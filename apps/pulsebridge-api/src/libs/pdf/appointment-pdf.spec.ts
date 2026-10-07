import { buildAppointmentPdf } from './appointment-pdf';

const toBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
	new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		doc.on('data', (chunk: Buffer) => chunks.push(chunk));
		doc.on('end', () => resolve(Buffer.concat(chunks)));
		doc.on('error', reject);
		doc.end();
	});

describe('buildAppointmentPdf', () => {
	it('builds a short PDF with latin, uzbek cyrillic and korean names', async () => {
		const appointment: any = {
			_id: '6ac3a0b071ab666332f504c4',
			appointmentDate: new Date('2026-10-13T00:00:00Z'),
			appointmentTime: '10:00',
			appointmentStatus: 'CONFIRMED',
			appointmentReason: 'Bosh og‘rig‘i / 두통',
			memberData: { memberFullName: 'Абдумалик Ўғли Қодиров', memberNick: 'abdu' },
			doctorData: { specialty: 'CARDIOLOGY', memberData: { memberNick: 'Andrew' } },
			clinicData: { clinicName: '서울 심장 클리닉', clinicAddress: 'Gangnam-daero 1, Seoul' },
		};
		const pdf = await toBuffer(buildAppointmentPdf(appointment));
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
		expect(pdf.length).toBeGreaterThan(2000);
		// the PDF is not written anywhere: only the stream above
	});

	it('skips empty rows (no reason, no clinic data)', async () => {
		const appointment: any = {
			_id: '6ac3a0b071ab666332f504c5',
			appointmentDate: new Date('2026-10-14T00:00:00Z'),
			appointmentTime: '14:30',
			memberData: { memberNick: 'pat1' },
		};
		const pdf = await toBuffer(buildAppointmentPdf(appointment));
		expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
	});
});
