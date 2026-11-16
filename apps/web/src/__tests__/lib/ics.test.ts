import { buildIcs } from '@/lib/ics';

const unfold = (ics: string) => ics.replace(/\r\n /g, '');
const base = {
    id: 'booking-1',
    summary: 'Стрижка — Low Fade',
    startISO: '2035-01-01T10:00:00+06:00',
    endISO: '2035-01-01T10:30:00+06:00',
    stampISO: '2034-12-31T12:00:00Z',
};

describe('buildIcs', () => {
    it('emits the RFC 5545 required properties with CRLF line endings', () => {
        const ics = buildIcs(base);

        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
        expect(ics.split('\r\n').every(line => !line.includes('\n'))).toBe(true);
        expect(ics).toContain('\r\nUID:booking-1@kezek.kg\r\n');
        expect(ics).toContain('\r\nDTSTAMP:20341231T120000Z\r\n');
        expect(ics).toContain('\r\nDTSTART:20350101T040000Z\r\n');
        expect(ics).toContain('\r\nDTEND:20350101T043000Z\r\n');
    });

    it('encodes newlines as escapes instead of literal backslash-n text', () => {
        const ics = unfold(buildIcs({ ...base, description: 'Бронь подтверждена', url: 'https://kezek.vercel.app/booking/booking-1' }));

        expect(ics).toContain('DESCRIPTION:Бронь подтверждена\\n\\nhttps://kezek.vercel.app/booking/booking-1\r\n');
        expect(ics).not.toContain('\\\\n');
        expect(ics).toContain('\r\nURL:https://kezek.vercel.app/booking/booking-1\r\n');
    });

    it('escapes TEXT delimiters', () => {
        const ics = unfold(buildIcs({ ...base, location: 'Бишкек, ул. Киевская; 1 \\ корпус' }));

        expect(ics).toContain('LOCATION:Бишкек\\, ул. Киевская\\; 1 \\\\ корпус\r\n');
    });

    it('folds long lines at 75 octets without splitting UTF-8 characters', () => {
        const summary = 'Очень длинное название услуги для проверки переноса строк '.repeat(4);
        const ics = buildIcs({ ...base, summary });

        for (const line of ics.split('\r\n')) {
            expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
        }
        expect(unfold(ics)).toContain(`SUMMARY:${summary}\r\n`);
    });

    it('marks status and sequence so clients replace the earlier version', () => {
        const ics = buildIcs({ ...base, status: 'CANCELLED', sequence: 3 });

        expect(ics).toContain('\r\nSTATUS:CANCELLED\r\n');
        expect(ics).toContain('\r\nSEQUENCE:3\r\n');
    });

    it('rejects invalid dates instead of emitting NaN', () => {
        expect(() => buildIcs({ ...base, startISO: 'not-a-date' })).toThrow('ICS_INVALID_DATE');
    });
});
