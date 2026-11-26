import { StatusPill } from '../../components/ui/Badge';
import type { Tone } from '../../constants/theme';
import { useLanguage, type MobileI18nKey } from '../../i18n';

const STATUS: Record<string, { key: MobileI18nKey; tone: Tone }> = {
    hold: { key: 'staff.bookingStatus.hold', tone: 'warning' },
    confirmed: { key: 'staff.bookingStatus.confirmed', tone: 'info' },
    paid: { key: 'staff.bookingStatus.paid', tone: 'success' },
    cancelled: { key: 'staff.bookingStatus.cancelled', tone: 'danger' },
    no_show: { key: 'staff.bookingStatus.noShow', tone: 'neutral' },
};

/** The state of a booking as a kit StatusPill (same texts as components/BookingStatusBadge). Unknown statuses show nothing. */
export function BookingStatusPill({ status }: { status: string | null | undefined }) {
    const { t } = useLanguage();
    const meta = status ? STATUS[status] : undefined;
    if (!meta) return null;
    return <StatusPill label={t(meta.key)} tone={meta.tone} />;
}
