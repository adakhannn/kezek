export type IcsStatus = 'TENTATIVE' | 'CONFIRMED' | 'CANCELLED';

/**
 * Single-event iCalendar object (RFC 5545). Times are emitted in UTC, so no
 * VTIMEZONE is needed. One booking keeps one UID; SEQUENCE and STATUS let
 * calendar clients replace the earlier version on hold → confirm → cancel.
 */
export function buildIcs(opts: {
    id: string;            // booking id
    summary: string;       // Заголовок, напр. "Бронь: Образ"
    description?: string;
    location?: string;
    startISO: string;      // ISO начала (UTC или c TZ-офсетом)
    endISO: string;        // ISO конца
    url?: string;          // ссылка на бронь
    status?: IcsStatus;
    sequence?: number;     // монотонная ревизия брони
    stampISO?: string;     // момент создания объекта (DTSTAMP), по умолчанию сейчас
}): string {
    const { id, summary, description = '', location = '', startISO, endISO, url, status, sequence, stampISO } = opts;

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kezek//Booking//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        // Opaque identifier, not a link: keep it stable so calendar clients
        // update existing events instead of duplicating them.
        `UID:${id}@kezek.kg`,
        `DTSTAMP:${formatUtc(stampISO ?? new Date().toISOString())}`,
        sequence === undefined ? '' : `SEQUENCE:${Math.max(0, Math.trunc(sequence))}`,
        status ? `STATUS:${status}` : '',
        `SUMMARY:${escapeText(summary)}`,
        `DESCRIPTION:${escapeText(description + (url ? `\n\n${url}` : ''))}`,
        `DTSTART:${formatUtc(startISO)}`,
        `DTEND:${formatUtc(endISO)}`,
        location ? `LOCATION:${escapeText(location)}` : '',
        url ? `URL:${url.replace(/[\r\n]/g, '')}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean);

    // Every content line, including the last one, ends with CRLF.
    return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** TEXT value escaping (RFC 5545 §3.3.11). */
function escapeText(value: string): string {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r\n|\r|\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Fold content lines longer than 75 octets (RFC 5545 §3.1) without splitting a UTF-8 character. */
function foldLine(line: string): string {
    if (encoder.encode(line).length <= 75) return line;
    const parts: string[] = [];
    let current = '';
    let currentBytes = 0;
    for (const char of line) {
        const bytes = encoder.encode(char).length;
        // Continuation lines start with a space, which counts toward the limit.
        const limit = parts.length === 0 ? 75 : 74;
        if (currentBytes + bytes > limit) {
            parts.push(current);
            current = '';
            currentBytes = 0;
        }
        current += char;
        currentBytes += bytes;
    }
    parts.push(current);
    return parts.join('\r\n ');
}

/** UTC DATE-TIME in the basic format YYYYMMDDTHHmmssZ. */
function formatUtc(dateISO: string): string {
    const d = new Date(dateISO);
    if (Number.isNaN(d.getTime())) throw new Error('ICS_INVALID_DATE');
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}
