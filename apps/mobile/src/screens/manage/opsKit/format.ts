import { format } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import { formatKyDate } from '../../../i18n/kyDate';
import type { Locale } from '../../../i18n/locale';
import { formatYmd } from '../../../utils/format';
import { ensureCurrentBusiness } from '../currentBusiness';

/** "26 ноября 2026" for a `YYYY-MM-DD` business date (no time zone shift). */
export function dayLabel(date: string, locale: Locale): string {
    if (!date) return '';
    return formatYmd(date, locale);
}

/** "ноябрь 2026" / "November 2026" / "2026-ж., ноябрь" for the month of a date. */
export function monthLabel(date: string, locale: Locale): string {
    if (!date) return '';
    const [year, month] = date.split('-').map(Number);
    const value = new Date(Date.UTC(year, (month || 1) - 1, 15, 12));
    if (locale === 'ky') return formatKyDate(value, { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const local = new Date(year, (month || 1) - 1, 15, 12);
    return format(local, 'LLLL yyyy', { locale: locale === 'en' ? enUS : ru });
}

/** "26.11.2026" for an instant in a time zone (lists of sold packages, applications). */
export function shortDate(iso: string, timeZone?: string | null): string {
    if (!iso) return '';
    const value = new Date(iso);
    if (!Number.isFinite(value.getTime())) return iso;
    return formatInTimeZone(value, resolveBusinessTimeZone(timeZone), 'dd.MM.yyyy');
}

/** "26.11.2026, 14:30" for an instant in a time zone. */
export function shortDateTime(iso: string, timeZone?: string | null): string {
    if (!iso) return '';
    const value = new Date(iso);
    if (!Number.isFinite(value.getTime())) return iso;
    return formatInTimeZone(value, resolveBusinessTimeZone(timeZone), 'dd.MM.yyyy, HH:mm');
}

/**
 * The web cabinet acts on the user's current business: a management screen reads and writes
 * only after the business it shows is made current (once per business per app run).
 */
export function useCurrentBusinessReady(bizId: string) {
    const query = useQuery({
        queryKey: ['manage-current-business', bizId],
        queryFn: async () => {
            await ensureCurrentBusiness(bizId);
            return true;
        },
        staleTime: Infinity,
    });
    return { ready: query.data === true, error: query.error, retry: () => void query.refetch() };
}
