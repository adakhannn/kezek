import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
import { useLanguage } from '../../i18n';
import { formatDate, formatPrice } from '../../utils/format';
import { styles } from './shiftsScreenStyles';
import type { Shift, ShiftStats } from './types';

type Props = {
    staffName: string;
    stats: ShiftStats;
    period: 'day' | 'month' | 'year';
    refreshing: boolean;
    onPeriodChange: (period: 'day' | 'month' | 'year') => void;
    onRefresh: () => Promise<void>;
};

export function ShiftsScreenSections({
    staffName,
    stats,
    period,
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

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>{t('staff.shifts.title')}</Text>
                <Text style={styles.subtitle}>{staffName}</Text>
            </View>

            <View style={styles.filters}>
                <View style={styles.periodButtons}>
                    {(['day', 'month', 'year'] as const).map((periodValue) => (
                        <MotionPressable
                            key={periodValue}
                            style={[styles.periodButton, period === periodValue && styles.periodButtonActive]}
                            onPress={() => onPeriodChange(periodValue)}
                        >
                            <Text
                                style={[
                                    styles.periodButtonText,
                                    period === periodValue && styles.periodButtonTextActive,
                                ]}
                            >
                                {t(`staff.shifts.period.${periodValue}`)}
                            </Text>
                        </MotionPressable>
                    ))}
                </View>
            </View>

            <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('staff.turnover')}</Text>
                    <Text style={styles.statValue}>{money(stats.totalAmount)}</Text>
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('staff.shifts.staffShare')}</Text>
                    <Text style={[styles.statValue, styles.statValueEmployee]}>
                        {money(stats.totalMaster)}
                    </Text>
                    {stats.totalAmount > 0 ? (
                        <Text style={styles.statPercent}>
                            {t('staff.shifts.percentOfRevenue', {
                                percent: ((baseMasterShare / stats.totalAmount) * 100).toFixed(1),
                            })}
                        </Text>
                    ) : null}
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>{t('staff.shifts.businessShare')}</Text>
                    <Text style={[styles.statValue, styles.statValueBusiness]}>
                        {money(stats.totalSalon)}
                    </Text>
                    {stats.totalAmount > 0 ? (
                        <Text style={styles.statPercent}>
                            {t('staff.shifts.percentOfRevenue', {
                                percent: ((baseSalonShare / stats.totalAmount) * 100).toFixed(1),
                            })}
                        </Text>
                    ) : null}
                </Card>
            </View>

            <View style={styles.additionalStats}>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>{t('staff.shifts.shiftsCount')}</Text>
                    <Text style={styles.additionalStatValue}>{stats.shiftsCount}</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>{t('staff.consumables')}</Text>
                    <Text style={styles.additionalStatValue}>{money(stats.totalConsumables)}</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>{t('staff.shifts.late')}</Text>
                    <Text style={styles.additionalStatValue}>{t('staff.minutes', { minutes: stats.totalLateMinutes })}</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>{t('staff.shifts.clients')}</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalClients}</Text>
                </Card>
            </View>

            {stats.shifts.length > 0 ? (
                <View style={styles.shiftsSection}>
                    <Text style={styles.sectionTitle}>{t('staff.shifts.periodTitle')}</Text>
                    {stats.shifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                    ))}
                </View>
            ) : (
                <View style={styles.emptySection}>
                    <EmptyState
                        icon="calendar"
                        title={t('staff.shifts.emptyTitle')}
                        message={t('staff.shifts.emptyMessage')}
                    />
                </View>
            )}
        </ScrollView>
    );
}

function ShiftCard({ shift }: { shift: Shift }) {
    const { t, locale } = useLanguage();
    const money = (amount: number) => formatPrice(amount, locale);
    const hours = (value: number) => t('staff.hours', { hours: value.toFixed(1) });
    const [expanded, setExpanded] = useState(shift.status === 'open');
    const hasGuaranteed =
        shift.guaranteed_amount > 0 &&
        !!shift.hourly_rate &&
        shift.guaranteed_amount > shift.base_master_share;

    return (
        <Card style={styles.shiftCard}>
            <MotionPressable style={styles.shiftHeader} onPress={() => setExpanded(!expanded)}>
                <View style={styles.shiftHeaderLeft}>
                    <View style={styles.shiftHeaderTop}>
                        <Text style={styles.shiftDate}>{formatDate(shift.shift_date, locale)}</Text>
                        <View
                            style={[
                                styles.shiftStatusBadge,
                                shift.status === 'open' ? styles.shiftStatusOpen : styles.shiftStatusClosed,
                            ]}
                        >
                            <Text
                                style={[
                                    styles.shiftStatusText,
                                    shift.status === 'open'
                                        ? styles.shiftStatusTextOpen
                                        : styles.shiftStatusTextClosed,
                                ]}
                            >
                                {t(shift.status === 'open' ? 'staff.status.open' : 'staff.status.closed')}
                            </Text>
                        </View>
                        {shift.items.length > 0 ? (
                            <Text style={styles.shiftClientsCount}>{t('staff.shifts.clientsCount', { count: shift.items.length })}</Text>
                        ) : null}
                    </View>
                    {shift.opened_at ? (
                        <Text style={styles.shiftTime}>
                            {t('staff.shifts.openedAt', {
                                time: new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                }),
                            })}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.shiftHeaderRight}>
                    <Text style={styles.shiftTotalAmount}>{money(shift.total_amount)}</Text>
                    <Text style={styles.shiftConsumables}>
                        {t('staff.shifts.consumablesAmount', { amount: money(shift.consumables_amount) })}
                    </Text>
                    {hasGuaranteed ? (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShareGuaranteed}>
                                {t('staff.shifts.toEmployee', { amount: money(shift.guaranteed_amount) })}
                            </Text>
                            {shift.hours_worked !== null ? (
                                <Text style={styles.shiftHours}>
                                    {t('staff.shifts.perShift', { value: hours(shift.hours_worked) })}
                                </Text>
                            ) : null}
                            <Text style={styles.shiftBaseShareStriked}>
                                {t('staff.shifts.baseShare', { amount: money(shift.base_master_share) })}
                            </Text>
                            <Text style={styles.shiftSalonShare}>
                                {t('staff.shifts.toBusiness', { amount: money(shift.salon_share) })}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShare}>
                                {t('staff.shifts.toEmployee', { amount: money(shift.master_share) })}
                            </Text>
                            {shift.guaranteed_amount > 0 && shift.hourly_rate ? (
                                <Text style={styles.shiftGuaranteed}>
                                    {t('staff.shifts.perShift', { value: money(shift.guaranteed_amount) })}
                                    {shift.hours_worked !== null ? (
                                        <Text> ({hours(shift.hours_worked)})</Text>
                                    ) : null}
                                </Text>
                            ) : null}
                            <Text style={styles.shiftSalonShare}>
                                {t('staff.shifts.toBusiness', { amount: money(shift.salon_share) })}
                            </Text>
                        </View>
                    )}
                </View>
            </MotionPressable>

            {expanded && shift.items.length > 0 ? (
                <View style={styles.shiftItems}>
                    <Text style={styles.shiftItemsTitle}>{t('staff.shifts.clientList')}</Text>
                    {shift.items.map((item) => (
                        <View key={item.id} style={styles.shiftItem}>
                            <View style={styles.shiftItemLeft}>
                                {item.booking_id ? <View style={styles.bookingIndicator} /> : null}
                                <View style={styles.shiftItemInfo}>
                                    <Text style={styles.shiftItemClient}>
                                        {item.client_name || t('staff.shifts.clientNotSpecified')}
                                    </Text>
                                    <Text style={styles.shiftItemService}>{item.service_name || '—'}</Text>
                                </View>
                            </View>
                            <View style={styles.shiftItemRight}>
                                <Text style={styles.shiftItemAmount}>{money(item.service_amount)}</Text>
                                {item.consumables_amount > 0 ? (
                                    <Text style={styles.shiftItemConsumables}>
                                        {t('staff.shifts.consumablesAmount', { amount: money(item.consumables_amount) })}
                                    </Text>
                                ) : null}
                                {item.created_at ? (
                                    <Text style={styles.shiftItemTime}>
                                        {new Date(item.created_at).toLocaleTimeString('ru-RU', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    ))}
                </View>
            ) : null}

            {expanded && shift.items.length === 0 ? (
                <View style={styles.shiftItemsEmpty}>
                    <Text style={styles.shiftItemsEmptyText}>{t('staff.shifts.noClients')}</Text>
                </View>
            ) : null}
        </Card>
    );
}

