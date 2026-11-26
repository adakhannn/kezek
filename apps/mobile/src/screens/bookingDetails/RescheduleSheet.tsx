import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import { formatTimeSlot } from '@shared-client/formatters';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import MotionPressable from '../../components/ui/MotionPressable';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { elevation, layout, radii, space, typeScale } from '../../constants/theme';
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
                    <View style={styles.grabber} />
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
    backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.surface.overlay },
    sheet: {
        maxHeight: '85%',
        backgroundColor: colors.surface.card,
        borderTopLeftRadius: radii.xxl,
        borderTopRightRadius: radii.xxl,
        paddingHorizontal: layout.gutter,
        paddingTop: space.sm,
        paddingBottom: space.xxl,
        gap: space.sm,
        ...elevation.floating,
    },
    grabber: {
        alignSelf: 'center',
        width: 36,
        height: 4,
        borderRadius: radii.pill,
        backgroundColor: colors.border.strong,
        marginBottom: space.sm,
    },
    title: { ...typeScale.title, color: colors.text.primary },
    hint: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, marginBottom: space.xs },
    label: { ...typeScale.overline, color: colors.text.tertiary, marginTop: space.md },
    daysRow: { gap: space.sm, paddingVertical: space.xs },
    dayChip: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: 60,
        paddingHorizontal: space.sm,
        paddingVertical: space.sm,
        borderRadius: radii.md,
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: colors.surface.elevated,
        alignItems: 'center',
    },
    dayWeekday: { ...typeScale.caption, color: colors.text.secondary },
    dayNumber: { ...typeScale.headline, color: colors.text.primary },
    dayMonth: { fontSize: 11, lineHeight: 14, color: colors.text.secondary },
    slotsScroll: { maxHeight: 260 },
    slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingVertical: space.xs },
    slotChip: {
        minHeight: MIN_TOUCH_TARGET,
        minWidth: 76,
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.surface.elevated,
        borderWidth: 1,
        borderColor: colors.surface.elevated,
        alignItems: 'center',
    },
    slotText: { ...typeScale.bodyStrong, color: colors.text.primary },
    chipSelected: { backgroundColor: colors.accent.primary, borderColor: colors.accent.primary },
    chipTextSelected: { color: colors.text.light },
    muted: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary },
    errorRow: { gap: space.sm },
    error: { ...typeScale.callout, fontWeight: '400', color: colors.tone.danger.fg },
    actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
    action: { flex: 1 },
});
