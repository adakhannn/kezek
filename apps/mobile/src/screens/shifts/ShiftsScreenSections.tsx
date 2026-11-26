import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StatusPill } from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import StatTile, { StatGrid } from '../../components/ui/StatTile';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { space, typeScale } from '../../constants/theme';
import { translatePlural, useLanguage } from '../../i18n';
import { formatDate, formatPrice } from '../../utils/format';
import FinancePeriodPicker from '../manage/finance/FinancePeriodPicker';
import type { Shift, ShiftStats } from './types';

type Period = 'day' | 'month' | 'year';

type Props = {
    staffName: string;
    stats: ShiftStats;
    period: Period;
    /** The shown day (YYYY-MM-DD); its month or year for those periods. */
    date: string;
    onDateChange: (date: string) => void;
    loading: boolean;
    onReload: () => void;
    refreshing: boolean;
    onPeriodChange: (period: Period) => void;
    onRefresh: () => Promise<void>;
};

/** The master's shifts and earnings for a day, month or year (the website's /staff/finance). */
export function ShiftsScreenSections({
    staffName,
    stats,
    period,
    date,
    onDateChange,
    loading,
    onReload,
    refreshing,
    onPeriodChange,
    onRefresh,
}: Props) {
    const { t, locale } = useLanguage();
    const money = (amount: number) => formatPrice(amount, locale);
    const hasBaseShareTotals =
        typeof stats.totalBaseMasterShare === 'number' &&
        typeof stats.totalBaseSalonShare === 'number';
    const baseSalonShare = Math.max(
        0,
        (hasBaseShareTotals ? stats.totalBaseSalonShare! : stats.totalSalon) -
            stats.totalConsumables,
    );
    const baseMasterShare = hasBaseShareTotals
        ? stats.totalBaseMasterShare!
        : Math.max(0, stats.totalAmount - baseSalonShare);
    const percent = (share: number) => stats.totalAmount > 0
        ? t('staff.shifts.percentOfRevenue', { percent: ((share / stats.totalAmount) * 100).toFixed(1) })
        : undefined;

    return (
        <Screen refreshing={refreshing} onRefresh={onRefresh} testID="shifts-screen">
            {/* The header says "Смены и статистика": the screen starts with whose numbers these are. */}
            <ScreenIntro>{staffName}</ScreenIntro>

            {/* Which day / month / year these are, with arrows and the calendar (the website's period picker). */}
            <FinancePeriodPicker
                period={period}
                anchor={date}
                loading={loading}
                onPeriodChange={onPeriodChange}
                onAnchorChange={onDateChange}
                onRefresh={onReload}
            />

            <View style={styles.kpis}>
                <StatTile label={t('staff.turnover')} value={money(stats.totalAmount)} icon="wallet-outline" tone="accent" />
                <StatGrid>
                    <StatTile
                        label={t('staff.shifts.staffShare')}
                        value={money(stats.totalMaster)}
                        hint={percent(baseMasterShare)}
                        tone="success"
                    />
                    <StatTile
                        label={t('staff.shifts.businessShare')}
                        value={money(stats.totalSalon)}
                        hint={percent(baseSalonShare)}
                        tone="info"
                    />
                </StatGrid>
                <StatGrid>
                    <StatTile label={t('staff.shifts.shiftsCount')} value={String(stats.shiftsCount)} icon="time-outline" />
                    <StatTile label={t('staff.shifts.clients')} value={String(stats.totalClients)} icon="people-outline" />
                    <StatTile label={t('staff.consumables')} value={money(stats.totalConsumables)} icon="flask-outline" />
                    <StatTile
                        label={t('staff.shifts.late')}
                        value={t('staff.minutes', { minutes: stats.totalLateMinutes })}
                        icon="alarm-outline"
                        tone={stats.totalLateMinutes > 0 ? 'warning' : undefined}
                    />
                </StatGrid>
            </View>

            {stats.shifts.length > 0 ? (
                <Section title={t('staff.shifts.periodTitle')}>
                    {stats.shifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                    ))}
                </Section>
            ) : (
                <EmptyState
                    icon="calendar-outline"
                    title={t('staff.shifts.emptyTitle')}
                    message={t('staff.shifts.emptyMessage')}
                />
            )}
        </Screen>
    );
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

/** One shift: date, state and total; tap to see the clients of the shift. */
function ShiftCard({ shift }: { shift: Shift }) {
    const { t, locale } = useLanguage();
    const money = (amount: number) => formatPrice(amount, locale);
    const hours = (value: number) => t('staff.hours', { hours: value.toFixed(1) });
    const [expanded, setExpanded] = useState(shift.status === 'open');
    const isOpen = shift.status === 'open';
    const hasGuaranteed =
        shift.guaranteed_amount > 0 &&
        !!shift.hourly_rate &&
        shift.guaranteed_amount > shift.base_master_share;

    return (
        <Card variant="plain" padding="md" style={styles.shift}>
            <Pressable
                onPress={() => setExpanded(!expanded)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={({ pressed }) => [styles.shiftHeader, pressed ? styles.pressed : null]}
            >
                <View style={styles.shiftMain}>
                    <View style={styles.shiftTitleRow}>
                        <Text style={styles.shiftDate}>{formatDate(shift.shift_date, locale)}</Text>
                        <StatusPill
                            label={t(isOpen ? 'staff.status.open' : 'staff.status.closed')}
                            tone={isOpen ? 'success' : 'neutral'}
                        />
                    </View>
                    <View style={styles.metaRow}>
                        {shift.opened_at ? (
                            <Text style={styles.meta}>{t('staff.shifts.openedAt', { time: clock(shift.opened_at) })}</Text>
                        ) : null}
                        {shift.items.length > 0 ? (
                            <Text style={styles.meta}>{translatePlural(t, 'staff.shifts.clientsCount', shift.items.length)}</Text>
                        ) : null}
                    </View>
                </View>
                <View style={styles.shiftTotal}>
                    <Text style={styles.totalAmount}>{money(shift.total_amount)}</Text>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.tertiary} />
                </View>
            </Pressable>

            <View style={styles.split}>
                {hasGuaranteed ? (
                    <>
                        <Text style={styles.toMaster}>{t('staff.shifts.toEmployee', { amount: money(shift.guaranteed_amount) })}</Text>
                        {shift.hours_worked !== null ? (
                            <Text style={styles.meta}>{t('staff.shifts.perShift', { value: hours(shift.hours_worked) })}</Text>
                        ) : null}
                        <Text style={[styles.meta, styles.striked]}>{t('staff.shifts.baseShare', { amount: money(shift.base_master_share) })}</Text>
                    </>
                ) : (
                    <>
                        <Text style={styles.toMaster}>{t('staff.shifts.toEmployee', { amount: money(shift.master_share) })}</Text>
                        {shift.guaranteed_amount > 0 && shift.hourly_rate ? (
                            <Text style={styles.meta}>
                                {t('staff.shifts.perShift', { value: money(shift.guaranteed_amount) })}
                                {shift.hours_worked !== null ? <Text> ({hours(shift.hours_worked)})</Text> : null}
                            </Text>
                        ) : null}
                    </>
                )}
                <Text style={styles.meta}>{t('staff.shifts.toBusiness', { amount: money(shift.salon_share) })}</Text>
                <Text style={styles.meta}>{t('staff.shifts.consumablesAmount', { amount: money(shift.consumables_amount) })}</Text>
            </View>

            {expanded ? (
                <View style={styles.items}>
                    {shift.items.length > 0 ? (
                        <>
                            <Text style={styles.itemsTitle} accessibilityRole="header">{t('staff.shifts.clientList')}</Text>
                            {shift.items.map((item) => (
                                <View key={item.id} style={styles.item}>
                                    <Ionicons
                                        name={item.booking_id ? 'calendar-outline' : 'create-outline'}
                                        size={16}
                                        color={item.booking_id ? colors.tone.success.fg : colors.text.tertiary}
                                        style={styles.itemIcon}
                                    />
                                    <View style={styles.itemBody}>
                                        <Text style={styles.itemClient} numberOfLines={1}>
                                            {item.client_name || t('staff.shifts.clientNotSpecified')}
                                        </Text>
                                        <Text style={styles.meta} numberOfLines={1}>{item.service_name || '—'}</Text>
                                    </View>
                                    <View style={styles.itemRight}>
                                        <Text style={styles.itemAmount}>{money(item.service_amount)}</Text>
                                        {item.consumables_amount > 0 ? (
                                            <Text style={styles.meta}>
                                                {t('staff.shifts.consumablesAmount', { amount: money(item.consumables_amount) })}
                                            </Text>
                                        ) : null}
                                        {item.created_at ? <Text style={styles.time}>{clock(item.created_at)}</Text> : null}
                                    </View>
                                </View>
                            ))}
                        </>
                    ) : (
                        <Text style={styles.meta}>{t('staff.shifts.noClients')}</Text>
                    )}
                </View>
            ) : null}
        </Card>
    );
}

const styles = StyleSheet.create({
    kpis: { gap: space.sm },
    shift: { gap: space.md },
    shiftHeader: { minHeight: MIN_TOUCH_TARGET, flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    pressed: { opacity: colors.interactive.pressedOpacity },
    shiftMain: { flex: 1, minWidth: 0, gap: space.xs },
    shiftTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
    shiftDate: { ...typeScale.headline, color: colors.text.primary },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm },
    meta: { ...typeScale.caption, color: colors.text.secondary },
    shiftTotal: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
    totalAmount: { ...typeScale.headline, color: colors.text.primary },
    split: {
        gap: space.xxs,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    toMaster: { ...typeScale.callout, fontWeight: '600', color: colors.tone.success.fg },
    striked: { textDecorationLine: 'line-through', color: colors.text.tertiary },
    items: {
        gap: space.sm,
        paddingTop: space.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    itemsTitle: { ...typeScale.overline, color: colors.text.tertiary },
    item: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.xs },
    itemIcon: { marginTop: space.xxs },
    itemBody: { flex: 1, minWidth: 0, gap: space.xxs },
    itemClient: { ...typeScale.bodyStrong, color: colors.text.primary },
    itemRight: { alignItems: 'flex-end', gap: space.xxs },
    itemAmount: { ...typeScale.bodyStrong, color: colors.text.primary },
    time: { ...typeScale.caption, color: colors.text.tertiary },
});
