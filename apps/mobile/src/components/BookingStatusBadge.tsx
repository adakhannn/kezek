import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../constants/colors';
import { useLanguage, type MobileI18nKey } from '../i18n';

const STATUS: Record<string, { key: MobileI18nKey; color: string; surface: string }> = {
    hold: { key: 'staff.bookingStatus.hold', color: colors.status.hold, surface: colors.feedback.warningSurface },
    confirmed: { key: 'staff.bookingStatus.confirmed', color: colors.status.info, surface: colors.feedback.infoSurface },
    paid: { key: 'staff.bookingStatus.paid', color: colors.status.success, surface: colors.feedback.successSurface },
    cancelled: { key: 'staff.bookingStatus.cancelled', color: colors.status.danger, surface: colors.feedback.dangerSurface },
    no_show: { key: 'staff.bookingStatus.noShow', color: colors.text.secondary, surface: colors.surface.elevated },
};

/** The booking status as the staff and business screens show it. Unknown statuses show nothing. */
export default function BookingStatusBadge({ status }: { status: string | null | undefined }) {
    const { t } = useLanguage();
    const meta = status ? STATUS[status] : undefined;
    if (!meta) return null;
    return (
        <View style={[styles.badge, { backgroundColor: meta.surface }]}>
            <Text style={[styles.text, { color: meta.color }]}>{t(meta.key)}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: 'flex-start',
        borderRadius: colors.layout.radiusSm,
        paddingHorizontal: colors.layout.space2,
        paddingVertical: 2,
    },
    text: {
        fontSize: 12,
        fontWeight: '600',
    },
});
