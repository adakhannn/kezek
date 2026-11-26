import { StyleSheet, View } from 'react-native';
import { canCancel, canConfirm, canMarkAttendance } from '@core-domain/booking';

import Button from '../../../components/ui/Button';
import { colors } from '../../../constants/colors';
import { space } from '../../../constants/theme';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useLanguage, type MobileI18nKey } from '../../../i18n';
import type { ManagerBookingAction } from '../../dashboard/types';
import type { BookingStatus } from './bookingsQuery';

const CONFIRM_TEXT: Record<ManagerBookingAction, { title: MobileI18nKey; message: MobileI18nKey }> = {
    confirm: { title: 'ops.bookings.actions.confirmTitle', message: 'ops.bookings.actions.confirmMessage' },
    cancel: { title: 'ops.bookings.actions.cancelTitle', message: 'ops.bookings.actions.cancelMessage' },
    attended: { title: 'ops.bookings.actions.attendedTitle', message: 'ops.bookings.actions.attendedMessage' },
    no_show: { title: 'ops.bookings.actions.noShowTitle', message: 'ops.bookings.actions.noShowMessage' },
};

/** The actions the website's QuickActions offers for a booking (the domain rules), each confirmed first. */
export function bookingRowActions(status: BookingStatus, startAt: string, now: Date): ManagerBookingAction[] {
    const actions: ManagerBookingAction[] = [];
    if (canConfirm(status)) actions.push('confirm');
    if (canMarkAttendance(status, { bookingStartAt: startAt, now })) actions.push('attended', 'no_show');
    if (canCancel(status)) actions.push('cancel');
    return actions;
}

export default function BookingRowActions({
    bookingId,
    status,
    startAt,
    now,
    pending,
    onAction,
}: {
    bookingId: string;
    status: BookingStatus;
    startAt: string;
    now: Date;
    pending: boolean;
    onAction: (bookingId: string, action: ManagerBookingAction) => void;
}) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const actions = bookingRowActions(status, startAt, now);
    if (actions.length === 0) return null;

    const run = async (action: ManagerBookingAction) => {
        const accepted = await confirm({
            title: t(CONFIRM_TEXT[action].title),
            message: t(CONFIRM_TEXT[action].message),
            confirmLabel: t('ops.bookings.actions.confirm'),
            cancelLabel: t('ops.bookings.actions.back'),
            variant: action === 'cancel' || action === 'no_show' ? 'danger' : undefined,
        });
        if (accepted) onAction(bookingId, action);
    };

    const label: Record<ManagerBookingAction, MobileI18nKey> = {
        confirm: 'ops.bookings.actions.confirm',
        cancel: 'ops.bookings.actions.cancel',
        attended: 'ops.bookings.actions.attended',
        no_show: 'ops.bookings.actions.noShow',
    };
    const positive = actions.filter((action) => action !== 'cancel');
    const button = (action: ManagerBookingAction) => (
        <Button
            key={action}
            title={t(label[action])}
            onPress={() => void run(action)}
            size="sm"
            variant={action === 'cancel' ? 'ghost' : action === 'no_show' ? 'outline' : 'secondary'}
            textStyle={action === 'cancel' ? styles.danger : undefined}
            loading={pending}
            disabled={pending}
            accessibilityLabel={`${t(label[action])} #${bookingId.slice(0, 8)}`}
        />
    );
    // Cancelling is destructive: it stands apart on the right, after a hairline.
    return (
        <View style={styles.bar}>
            <View style={styles.positive}>{positive.map(button)}</View>
            {actions.includes('cancel') ? button('cancel') : null}
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingTop: space.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    positive: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
    danger: { color: colors.tone.danger.fg },
});
