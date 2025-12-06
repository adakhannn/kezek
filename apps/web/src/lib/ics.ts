
export function buildIcs(opts: {
    id: string;          // booking id
    summary: string;     // Заголовок, напр. "Бронь: Образ"
    description?: string;
    location?: string;
    startISO: string;    // ISO начала (UTC или c TZ-офсетом)
    endISO: string;      // ISO конца
    tz: string;          // 'Asia/Bishkek'
    url?: string;        // ссылка на бронь
}) {
    const { id, summary, description = '', location = '', startISO, endISO, tz, url } = opts;

    // Формат UTC для ICS
    const dtStart = formatICS(startISO, tz);
    const dtEnd   = formatICS(endISO, tz);

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kezek//Booking//RU',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${id}@kezek.kg`,
        `SUMMARY:${escape(summary)}`,
        `DESCRIPTION:${escape((description || '') + (url ? `\\n\\n${url}` : ''))}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        location ? `LOCATION:${escape(location)}` : '',
        'END:VEVENT',
        'END:VCALENDAR',
    ].filter(Boolean);

    return lines.join('\r\n');
}

function escape(s: string) {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function formatICS(dateISO: string, _tz: string) {
    // Переведём время в локаль TZ и запишем в формат UTC (Z)
    // ICS допускает локальное время, но надёжнее Zulu
    // _tz пока не используется, но может понадобиться для будущих улучшений
    const d = new Date(dateISO);
    // формат YYYYMMDDTHHmmssZ
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mi = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
}