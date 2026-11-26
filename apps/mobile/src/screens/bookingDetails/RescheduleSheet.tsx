import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import MotionPressable from '../../components/ui/MotionPressable';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import { loadRescheduleSlots, rescheduleDays, type RescheduleTarget } from '../../lib/bookingReschedule';
import { formatBookingDateLabel } from '../booking/bookingFormat';

type Props = {
    visible: boolean;
    target: RescheduleTarget;
    timeZone?: string | null;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: (startAt: string) => void;
};

/** A day and a free start of the same master; the booking keeps its staff, branch and services. */
export function RescheduleSheet({ visible, target, timeZone, isSubmitting, onClose, onConfirm }: Props) {
    const { t, locale } = useLanguage();
    const tz = resolveBusinessTimeZone(timeZone);
    const days = useMemo(() => rescheduleDays(tz), [tz]);
    const [day, setDay] = useState(days[0]);
    const [selected, setSelected] = useState<string | null>(null);

    const slotsQuery = useQuery({
        queryKey: ['reschedule-slots', target.bizId, target.staffId, target.branchId, target.startAt, target.endAt, day],
        queryFn: () => loadRescheduleSlots(target, day),
        enabled: visible,
        staleTime: 0,
    });
    const slots = slotsQuery.data ?? [];

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { if (!isSubmitting) onClose(); }}>
            <View style={styles.backdrop}>
                <View style={styles.sheet} testID="reschedule-sheet">
                    <Text style={styles.title}>{t('cabinet.details.rescheduleTitle')}</Text>
                    <Text style={styles.hint}>{t('cabinet.details.rescheduleHint')}</Text>

                    <Text style={styles.label}>{t('cabinet.details.rescheduleDay')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysRow}>
                        {days.map((value) => {
                            const label = formatBookingDateLabel(value, locale);
                            const active = value === day;
                            return (
                                <MotionPressable
                                    key={value}
                                    style={[styles.dayChip, active && styles.chipSelected]}
                                    onPress={() => { setDay(value); setSelected(null); }}
                                    accessibilityState={{ selected: active }}
                                    accessibilityLabel={`${label.weekday}, ${label.dayMonth}`}
                                >
                                    <Text style={[styles.dayWeekday, active && styles.chipTextSelected]}>{label.weekday}</Text>
                                    <Text style={[styles.dayNumber, active && styles.chipTextSelected]}>{label.day}</Text>
                                    {/* The two weeks can cross a month: the chip names it. */}
                                    <Text style={[styles.dayMonth, active && styles.chipTextSelected]} numberOfLines={1}>
                                        {label.month}
                                    </Text>
                                </MotionPressable>
                            );
                        })}
                    </ScrollView>

                    <Text style={styles.label}>{t('cabinet.details.rescheduleTime')}</Text>
                    <ScrollView style={styles.slotsScroll} contentContainerStyle={styles.slotsGrid}>
                        {slotsQuery.isLoading ? (
                            <Text style={styles.muted}>{t('cabinet.details.rescheduleLoading')}</Text>
                        ) : slotsQuery.isError ? (
                            <View style={styles.errorRow}>
                                <Text style={styles.error}>{t('cabinet.details.rescheduleLoadError')}</Text>
                                <Button title={t('cabinet.ui.retry')} size="sm" variant="outline" onPress={() => void slotsQuery.refetch()} />
                            </View>
                        ) : slots.length === 0 ? (
                            <Text style={styles.muted}>{t('cabinet.details.rescheduleEmpty')}</Text>
                        ) : (
                            slots.map((slot) => {
                                const active = selected === slot.start_at;
                                return (
                                    <MotionPressable
                                        key={slot.start_at}
                                        style={[styles.slotChip, active && styles.chipSelected]}
                                        onPress={() => setSelected(slot.start_at)}
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Text style={[styles.slotText, active && styles.chipTextSelected]}>
                                            {formatTimeSlot(slot.start_at, tz)}
                                        </Text>
                                    </MotionPressable>
                                );
                            })
                        )}
                    </ScrollView>

                    <View style={styles.actions}>
                        <Button
                            title={t('cabinet.details.rescheduleKeep')}
                            variant="outline"
                            onPress={onClose}
                            disabled={isSubmitting}
                            style={styles.action}
                        />
                        <Button
                            title={t('cabinet.details.rescheduleConfirm')}
                            onPress={() => { if (selected) onConfirm(selected); }}
                            disabled={!selected || isSubmitting}
                            loading={isSubmitting}
                            style={styles.action}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17, 24, 39, 0.45)' },
    sheet: {
        maxHeight: '85%',
        backgroundColor: colors.background.secondary,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        gap: 8,
    },
    title: { fontSize: 20, fontWeight: '600', color: colors.text.primary },
    hint: { fontSize: 14, color: colors.text.secondary, marginBottom: 8 },
    label: { fontSize: 14, fontWeight: '600', color: colors.text.secondary, marginTop: 8 },
    daysRow: { gap: 8, paddingVertical: 4 },
    dayChip: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: 56,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border.light,
        alignItems: 'center',
    },
    dayWeekday: { fontSize: 12, color: colors.text.secondary },
    dayNumber: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
    dayMonth: { fontSize: 11, color: colors.text.secondary },
    slotsScroll: { maxHeight: 260 },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 4 },
    slotChip: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: 80,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.border.light,
        alignItems: 'center',
    },
    slotText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
    chipSelected: { borderColor: colors.primary.from },
    chipTextSelected: { color: colors.primary.from },
    muted: { fontSize: 14, color: colors.text.secondary },
    errorRow: { gap: 8 },
    error: { fontSize: 14, color: colors.status.danger },
    actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
    action: { flex: 1 },
});
