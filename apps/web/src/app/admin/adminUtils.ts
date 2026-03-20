import type { BookingRel, TodayBookingRow } from './adminTypes';

export function bishkekDayRange() {
    const tzOffset = '+06:00';
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const ymd = fmt.format(new Date());
    const start = new Date(`${ymd}T00:00:00${tzOffset}`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: ymd };
}

export function fmtTimeBishkek(iso: string) {
    return new Intl.DateTimeFormat('ru-RU', {
        timeZone: 'Asia/Bishkek',
        hour: '2-digit',
        minute: '2-digit',
    }).format(new Date(iso));
}

export function normRel<T>(rel: T | T[] | null | undefined): T | null {
    if (rel == null) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

export function mapTodayBookings(rows: BookingRel[]): TodayBookingRow[] {
    return rows.map((row) => {
        const svc = normRel(row.services);
        const stf = normRel(row.staff);
        const biz = normRel(row.businesses);
        const br = normRel(row.branches);

        return {
            id: row.id,
            start_at: row.start_at,
            end_at: row.end_at,
            status: row.status,
            client: row.client_name || row.client_phone || '—',
            service: svc?.name_ru ?? '—',
            staff: stf?.full_name ?? '—',
            biz: biz?.name ?? '—',
            bizId: biz?.id ?? null,
            branch: br?.name ?? '—',
        };
    });
}
