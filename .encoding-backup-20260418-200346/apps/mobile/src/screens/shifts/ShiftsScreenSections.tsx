import { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';

import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import MotionPressable from '../../components/ui/MotionPressable';
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
    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
            <View style={styles.header}>
                <Text style={styles.title}>РЎРјРµРЅС‹ Рё СЃС‚Р°С‚РёСЃС‚РёРєР°</Text>
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
                                {periodValue === 'day' ? '????' : periodValue === 'month' ? '?????' : '???'}
                            </Text>
                        </MotionPressable>
                    ))}
                </View>
            </View>

            <View style={styles.statsGrid}>
                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>РћР±РѕСЂРѕС‚</Text>
                    <Text style={styles.statValue}>{formatPrice(stats.totalAmount)}</Text>
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Р”РѕР»СЏ СЃРѕС‚СЂСѓРґРЅРёРєР°</Text>
                    <Text style={[styles.statValue, styles.statValueEmployee]}>
                        {formatPrice(stats.totalMaster)}
                    </Text>
                    {stats.totalAmount > 0 ? (
                        <Text style={styles.statPercent}>
                            {((stats.totalMaster / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    ) : null}
                </Card>

                <Card style={styles.statCard}>
                    <Text style={styles.statLabel}>Р”РѕР»СЏ Р±РёР·РЅРµСЃР°</Text>
                    <Text style={[styles.statValue, styles.statValueBusiness]}>
                        {formatPrice(stats.totalSalon)}
                    </Text>
                    {stats.totalAmount > 0 ? (
                        <Text style={styles.statPercent}>
                            {((stats.totalSalon / stats.totalAmount) * 100).toFixed(1)}%
                        </Text>
                    ) : null}
                </Card>
            </View>

            <View style={styles.additionalStats}>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>РЎРјРµРЅ</Text>
                    <Text style={styles.additionalStatValue}>{stats.shiftsCount}</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>Р Р°СЃС…РѕРґРЅРёРєРё</Text>
                    <Text style={styles.additionalStatValue}>{formatPrice(stats.totalConsumables)}</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>РћРїРѕР·РґР°РЅРёСЏ</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalLateMinutes} ???</Text>
                </Card>
                <Card style={styles.additionalStatCard}>
                    <Text style={styles.additionalStatLabel}>РљР»РёРµРЅС‚РѕРІ</Text>
                    <Text style={styles.additionalStatValue}>{stats.totalClients}</Text>
                </Card>
            </View>

            {stats.shifts.length > 0 ? (
                <View style={styles.shiftsSection}>
                    <Text style={styles.sectionTitle}>РЎРјРµРЅС‹ Р·Р° РїРµСЂРёРѕРґ</Text>
                    {stats.shifts.map((shift) => (
                        <ShiftCard key={shift.id} shift={shift} />
                    ))}
                </View>
            ) : (
                <View style={styles.emptySection}>
                    <EmptyState
                        icon="calendar"
                        title="РќРµС‚ СЃРјРµРЅ"
                        message="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ СЃРјРµРЅ РЅРµ РЅР°Р№РґРµРЅРѕ"
                    />
                </View>
            )}
        </ScrollView>
    );
}

function ShiftCard({ shift }: { shift: Shift }) {
    const [expanded, setExpanded] = useState(shift.status === 'open');
    const hasGuaranteed =
        shift.guaranteed_amount > 0 && !!shift.hourly_rate && shift.guaranteed_amount > shift.master_share;

    return (
        <Card style={styles.shiftCard}>
            <MotionPressable style={styles.shiftHeader} onPress={() => setExpanded(!expanded)}>
                <View style={styles.shiftHeaderLeft}>
                    <View style={styles.shiftHeaderTop}>
                        <Text style={styles.shiftDate}>{formatDate(shift.shift_date)}</Text>
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
                                {shift.status === 'open' ? '???????' : '???????'}
                            </Text>
                        </View>
                        {shift.items.length > 0 ? (
                            <Text style={styles.shiftClientsCount}>({shift.items.length} ????????)</Text>
                        ) : null}
                    </View>
                    {shift.opened_at ? (
                        <Text style={styles.shiftTime}>
                            РћС‚РєСЂС‹С‚Р°:{' '}
                            {new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </Text>
                    ) : null}
                </View>
                <View style={styles.shiftHeaderRight}>
                    <Text style={styles.shiftTotalAmount}>{formatPrice(shift.total_amount)}</Text>
                    <Text style={styles.shiftConsumables}>
                        ??????????: {formatPrice(shift.consumables_amount)}
                    </Text>
                    {hasGuaranteed ? (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShareGuaranteed}>
                                ??????????: {formatPrice(shift.guaranteed_amount)}
                            </Text>
                            {shift.hours_worked !== null ? (
                                <Text style={styles.shiftHours}>
                                    ?? ?????: {shift.hours_worked.toFixed(1)} ?
                                </Text>
                            ) : null}
                            <Text style={styles.shiftBaseShareStriked}>
                                Р‘Р°Р·РѕРІР°СЏ: {formatPrice(shift.master_share)}
                            </Text>
                            <Text style={styles.shiftSalonShare}>
                                Р‘РёР·РЅРµСЃСѓ: {formatPrice(shift.salon_share)}
                            </Text>
                        </View>
                    ) : (
                        <View style={styles.shiftFinancials}>
                            <Text style={styles.shiftMasterShare}>
                                РЎРѕС‚СЂСѓРґРЅРёРєСѓ: {formatPrice(shift.master_share)}
                            </Text>
                            {shift.guaranteed_amount > 0 && shift.hourly_rate ? (
                                <Text style={styles.shiftGuaranteed}>
                                    ?? ?????: {formatPrice(shift.guaranteed_amount)}
                                    {shift.hours_worked !== null ? (
                                        <Text> ({shift.hours_worked.toFixed(1)} ?)</Text>
                                    ) : null}
                                </Text>
                            ) : null}
                            <Text style={styles.shiftSalonShare}>
                                Р‘РёР·РЅРµСЃСѓ: {formatPrice(shift.salon_share)}
                            </Text>
                        </View>
                    )}
                </View>
            </MotionPressable>

            {expanded && shift.items.length > 0 ? (
                <View style={styles.shiftItems}>
                    <Text style={styles.shiftItemsTitle}>РЎРїРёСЃРѕРє РєР»РёРµРЅС‚РѕРІ</Text>
                    {shift.items.map((item) => (
                        <View key={item.id} style={styles.shiftItem}>
                            <View style={styles.shiftItemLeft}>
                                {item.booking_id ? <View style={styles.bookingIndicator} /> : null}
                                <View style={styles.shiftItemInfo}>
                                    <Text style={styles.shiftItemClient}>
                                        {item.client_name || 'РљР»РёРµРЅС‚ РЅРµ СѓРєР°Р·Р°РЅ'}
                                    </Text>
                                    <Text style={styles.shiftItemService}>{item.service_name || 'вЂ”'}</Text>
                                </View>
                            </View>
                            <View style={styles.shiftItemRight}>
                                <Text style={styles.shiftItemAmount}>{formatPrice(item.service_amount)}</Text>
                                {item.consumables_amount > 0 ? (
                                    <Text style={styles.shiftItemConsumables}>
                                        ??????????: {formatPrice(item.consumables_amount)}
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
                    <Text style={styles.shiftItemsEmptyText}>РќРµС‚ РґРѕР±Р°РІР»РµРЅРЅС‹С… РєР»РёРµРЅС‚РѕРІ</Text>
                </View>
            ) : null}
        </Card>
    );
}
