import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { translatePlural } from '../../i18n/plural';
import type { RootStackParamList } from '../../navigation/types';
import { fetchFinanceAuditLog, fetchFinanceStats, updateShiftHours } from './api';
import { staffErrorMessage } from './errors';
import {
    formatAmount,
    formatShare,
    parseShiftHours,
    shiftEmployeeAmount,
    shiftStatsDate,
    statsDateParam,
    statsSummary,
} from './financeView';
import { staffQueryKeys } from './queryKeys';
import type { StaffFinanceStatsPeriod, StaffFinanceStatsShift } from './types';
import { Badge, Chip, SectionTitle, StatTile, dmy, ui } from './ui';

const AUDIT_FIELDS: Record<string, MobileI18nKey> = {
    percent_master: 'manageStaff.finance.auditLog.field.percentMaster',
    percent_salon: 'manageStaff.finance.auditLog.field.percentSalon',
    hourly_rate: 'manageStaff.finance.auditLog.field.hourlyRate',
};

/** /dashboard/staff/[id]/finance/stats: money by day, month or year, the shift ledger and the settings audit. */
export default function ManageStaffFinanceStatsScreen() {
    const { params } = useRoute<RouteProp<RootStackParamList, 'ManageStaffFinanceStats'>>();
    const { t, locale } = useLanguage();
    const tz = resolveBusinessTimeZone(params.tz);
    const [period, setPeriod] = useState<StaffFinanceStatsPeriod>('day');
    const [date, setDate] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const stats = useQuery({
        queryKey: staffQueryKeys.stats(params.bizId, params.staffId, period, date),
        queryFn: () => fetchFinanceStats(params.bizId, params.staffId, period, date ? statsDateParam(period, date) : null),
    });
    const audit = useQuery({
        queryKey: staffQueryKeys.audit(params.bizId, params.staffId),
        queryFn: () => fetchFinanceAuditLog(params.bizId, params.staffId),
    });

    const money = (value: number) => t('manageStaff.finance.money', { amount: formatAmount(value, locale) });
    const shownDate = date ?? stats.data?.dateFrom ?? '';
    const periodLabel = !shownDate ? '' : period === 'day' ? dmy(shownDate) : period === 'month' ? `${shownDate.slice(5, 7)}.${shownDate.slice(0, 4)}` : shownDate.slice(0, 4);

    const refresh = async () => {
        setRefreshing(true);
        try { await Promise.all([stats.refetch(), audit.refetch()]); } finally { setRefreshing(false); }
    };

    const header = (
        <View>
            <Badge label={t('manageStaff.finance.staffStats.title')} tone="accent" />
            <Text style={[ui.title, styles.title]} accessibilityRole="header">{t('manageStaff.finance.staffStats.title')}: {params.staffName ?? ''}</Text>
            <Text style={ui.muted}>{t('manageStaff.finance.staffStats.subtitle')}</Text>
        </View>
    );

    let body;
    if (stats.isLoading && !stats.data) {
        body = <LoadingSpinner message={t('manageStaff.finance.loading')} />;
    } else if (stats.error && !stats.data) {
        body = (
            <FeedbackBanner
                variant="danger"
                title={t('manageStaff.finance.error.title')}
                message={staffErrorMessage(stats.error, t('manageStaff.finance.loadError'), t)}
                action={<Button title={t('manageStaff.finance.retry')} onPress={() => void stats.refetch()} size="sm" variant="outline" />}
            />
        );
    } else if (!stats.data) {
        body = (
            <EmptyState
                title={t('manageStaff.finance.empty.title')}
                message={t('manageStaff.finance.empty.description')}
                action={<Button title={t('manageStaff.finance.refresh')} onPress={() => void stats.refetch()} variant="outline" fullWidth />}
            />
        );
    } else {
        const data = stats.data;
        const summary = statsSummary(data);
        const flags = [
            summary.flags.lateMinutes !== null ? `${t('manageStaff.finance.flags.late')}: ${summary.flags.lateMinutes}` : null,
            summary.flags.consumables !== null ? `${t('manageStaff.finance.flags.consumables')}: ${money(summary.flags.consumables)}` : null,
            summary.flags.guarantee !== null ? `${t('manageStaff.finance.flags.guarantee')}: ${money(summary.flags.guarantee)}` : null,
        ].filter((flag): flag is string => !!flag);
        body = (
            <>
                {stats.isFetching ? <Text style={ui.muted}>{t('manageStaff.finance.loading')}</Text> : null}
                <View style={ui.wrap}>
                    <StatTile label={t('manageStaff.finance.staffStats.turnover')} value={money(summary.turnover)} hint={periodLabel} />
                    <StatTile label={t('manageStaff.finance.staffStats.toEmployee')} value={money(data.totalMaster)} tone="success"
                        hint={`${formatShare(data.totalMaster, summary.turnover)} • ${t('manageStaff.finance.share.split')}`} />
                    <StatTile label={t('manageStaff.finance.staffStats.toBusiness')} value={money(data.totalSalon)} tone="accent"
                        hint={`${formatShare(data.totalSalon, summary.turnover)} • ${t('manageStaff.finance.share.split')}`} />
                    <StatTile label={t('manageStaff.finance.guarantees.title')} value={money(summary.guaranteeUsed ? summary.topup : 0)} tone="warning"
                        hint={summary.guaranteeUsed
                            ? `${t('manageStaff.finance.guarantees.baseShare')}: ${money(data.totalBaseMasterShare)}`
                            : t('manageStaff.finance.guarantees.notUsed')} />
                </View>

                <Card style={ui.gap}>
                    <SectionTitle
                        title={t('manageStaff.finance.operational.readout')}
                        description={t('manageStaff.finance.operational.readoutDesc')}
                        right={<Badge label={t(flags.length > 0 ? 'manageStaff.finance.flags.reviewNeeded' : 'manageStaff.finance.flags.stable')} tone={flags.length > 0 ? 'warning' : 'success'} />}
                    />
                    <View style={ui.wrap}>
                        <StatTile label={t('manageStaff.finance.staffStats.shifts')} value={String(data.shiftsCount)}
                            hint={`${t('manageStaff.finance.shifts.openCount', { count: String(data.openShiftsCount) })} • ${t('manageStaff.finance.shifts.closedCount', { count: String(data.closedShiftsCount) })}`} />
                        <StatTile label={t('manageStaff.finance.staffStats.clients')} value={String(data.totalClients)} />
                        <StatTile label={t('manageStaff.finance.staffStats.consumables')} value={money(data.totalConsumables)} />
                        <StatTile label={t('manageStaff.finance.staffStats.late')} value={`${data.totalLateMinutes} ${t('manageStaff.finance.minutes')}`} />
                        <StatTile label={t('manageStaff.finance.period.label')} value={periodLabel} hint={t(`manageStaff.finance.period.${period}`)} />
                    </View>
                    {flags.length > 0 ? (
                        <View style={ui.wrap}>{flags.map((flag) => <Badge key={flag} label={flag} tone="warning" />)}</View>
                    ) : null}
                </Card>

                {data.shifts.length > 0 ? (
                    <Card style={ui.gap}>
                        <SectionTitle
                            title={t('manageStaff.finance.staffStats.shiftsPeriod')}
                            description={t('manageStaff.finance.staffStats.shiftsPeriodDesc')}
                            right={<Badge label={translatePlural(t, 'manageStaff.shiftCount', data.shifts.length)} />}
                        />
                        {data.shifts.map((shift) => (
                            <ShiftCard key={shift.id} bizId={params.bizId} shift={shift} onHoursUpdated={() => stats.refetch()} />
                        ))}
                    </Card>
                ) : null}
            </>
        );
    }

    return (
        <ScrollView
            style={ui.container}
            contentContainerStyle={ui.content}
            keyboardShouldPersistTaps="handled"
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
            testID="manage-staff-finance-stats"
        >
            {header}
            <Card style={ui.gap}>
                <SectionTitle title={t('manageStaff.finance.filters.title')} description={t('manageStaff.finance.filters.description')} />
                <View style={ui.wrap}>
                    {(['day', 'month', 'year'] as const).map((value) => (
                        <Chip key={value} label={t(`manageStaff.finance.period.${value}`)} selected={period === value} onPress={() => setPeriod(value)} disabled={stats.isFetching} />
                    ))}
                </View>
                <Text style={ui.label}>{t('manageStaff.finance.filters.dateLabel')}</Text>
                <View style={ui.wrap}>
                    <Chip label={t('manageStaff.date.previous')} selected={false} disabled={stats.isFetching || !shownDate}
                        onPress={() => setDate(shiftStatsDate(period, shownDate, -1))} />
                    <Chip label={t('manageStaff.date.today')} selected={date === null} disabled={stats.isFetching}
                        onPress={() => setDate(null)} />
                    <Chip label={t('manageStaff.date.next')} selected={false} disabled={stats.isFetching || !shownDate}
                        onPress={() => setDate(shiftStatsDate(period, shownDate, 1))} />
                </View>
                <Text style={ui.text}>{periodLabel}</Text>
                <Button title={t(stats.isFetching ? 'manageStaff.finance.loading' : 'manageStaff.finance.update')} onPress={() => void stats.refetch()} disabled={stats.isFetching} variant="outline" size="sm" />
            </Card>
            {body}
            <Card style={ui.gap}>
                <SectionTitle
                    title={t('manageStaff.finance.auditLog.title')}
                    description={t('manageStaff.finance.auditLog.subtitle')}
                    right={<Badge label={String(audit.data?.length ?? 0)} />}
                />
                {audit.isLoading ? <Text style={ui.muted}>{t('manageStaff.finance.loading')}</Text> : null}
                {audit.error ? (
                    <FeedbackBanner variant="danger" title={t('manageStaff.finance.auditLog.loadErrorTitle')} message={staffErrorMessage(audit.error, t('manageStaff.loadError'), t)} />
                ) : null}
                {audit.data && audit.data.length === 0 ? <Text style={ui.muted}>{t('manageStaff.finance.auditLog.empty')}</Text> : null}
                {(audit.data ?? []).map((entry) => (
                    <View key={entry.id} style={styles.audit}>
                        <Text style={ui.muted}>{formatInTimeZone(new Date(entry.changed_at), tz, 'dd.MM.yyyy HH:mm')}</Text>
                        <Text style={ui.text}>{entry.changed_by_name || t('manageStaff.finance.auditLog.unknownUser')}</Text>
                        {entry.field_changes.length > 0 ? entry.field_changes.map((change, index) => (
                            <Text key={`${entry.id}-${index}`} style={ui.muted}>
                                {AUDIT_FIELDS[change.field] ? t(AUDIT_FIELDS[change.field]) : change.field}: {change.old_value === null ? '—' : String(change.old_value)} → {change.new_value === null ? '—' : String(change.new_value)}
                            </Text>
                        )) : <Text style={ui.muted}>{entry.message || '—'}</Text>}
                    </View>
                ))}
            </Card>
        </ScrollView>
    );
}

/** The website's StaffFinanceShiftCard: one shift's money, its clients and the hours correction. */
function ShiftCard({ bizId, shift, onHoursUpdated }: { bizId: string; shift: StaffFinanceStatsShift; onHoursUpdated: () => Promise<unknown> }) {
    const { t, locale } = useLanguage();
    const [expanded, setExpanded] = useState(shift.status === 'open');
    const [editing, setEditing] = useState(false);
    const [hours, setHours] = useState('');
    const [version, setVersion] = useState<{ id: string; revision: number } | null>(null);
    const [requiresReview, setRequiresReview] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const money = (value: number) => t('manageStaff.finance.money', { amount: formatAmount(value, locale) });
    const time = (iso: string | null) => (iso ? formatInTimeZone(new Date(iso), shift.timezone, 'HH:mm') : null);
    const opened = time(shift.opened_at);
    const closed = time(shift.closed_at);

    const startEdit = () => {
        const current = shift.hours_worked ?? 0;
        setHours(Number.isFinite(current) ? current.toFixed(2) : '0.00');
        setVersion({ id: shift.id, revision: shift.ledger_revision });
        setRequiresReview(false);
        setError(null);
        setEditing((value) => !value);
    };

    const save = async () => {
        if (saving || requiresReview || !version) return;
        const parsed = parseShiftHours(hours, shift.day_hours);
        if (!parsed.ok) { setError(t('manageStaff.finance.staffStats.editHoursInvalid')); return; }
        setError(null);
        setSaving(true);
        try {
            await updateShiftHours(bizId, version.id, parsed.hours, version.revision);
            setEditing(false);
            await onHoursUpdated();
        } catch (cause) {
            // Any failure (stale revision, unknown outcome) needs a reload before another try.
            setRequiresReview(true);
            setError(staffErrorMessage(cause, t('manageStaff.finance.staffStats.editHoursError'), t));
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.shift}>
            <MotionPressable
                onPress={() => setExpanded((value) => !value)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${dmy(shift.shift_date)}, ${money(shift.total_amount + shift.consumables_amount)}`}
                style={styles.shiftHeader}
            >
                <View style={styles.flex}>
                    <View style={ui.wrap}>
                        <Text style={styles.shiftDate}>{dmy(shift.shift_date)}</Text>
                        <Badge label={t(shift.status === 'open' ? 'manageStaff.finance.staffStats.status.open' : 'manageStaff.finance.staffStats.status.closed')} tone={shift.status === 'open' ? 'success' : 'muted'} />
                        <Text style={ui.muted}>{translatePlural(t, 'manageStaff.clientCount', shift.items.length)}</Text>
                    </View>
                    <Text style={ui.muted}>
                        {opened ? `${t('manageStaff.finance.staffStats.openedAt')}: ${opened}` : t('manageStaff.finance.shift.noOpenTime')}
                        {closed ? ` • ${t('manageStaff.finance.shift.closedAt')}: ${closed}` : ''}
                    </Text>
                    <Text style={ui.text}>{money(shift.total_amount + shift.consumables_amount)}</Text>
                    <Text style={ui.muted}>{t('manageStaff.finance.staffStats.consumables')}: {money(shift.consumables_amount)}</Text>
                    <Text style={styles.success}>{t('manageStaff.finance.staffStats.toEmployee')}: {money(shiftEmployeeAmount(shift))}</Text>
                    <Text style={styles.accent}>{t('manageStaff.finance.staffStats.toBusiness')}: {money(shift.salon_share)}</Text>
                </View>
            </MotionPressable>
            {expanded ? (
                <View style={ui.gap}>
                    <View style={ui.wrap}>
                        <StatTile label={t('manageStaff.finance.staffStats.baseShare')} value={money(shift.base_master_share ?? shift.master_share)} />
                        <StatTile label={t('manageStaff.finance.staffStats.guaranteedAmount')} value={money(shift.guaranteed_amount)} />
                        <StatTile label={t('manageStaff.finance.staffStats.hours')} value={shift.hours_worked !== null ? shift.hours_worked.toFixed(2) : '—'} />
                    </View>
                    {shift.status === 'closed' || editing ? (
                        <View style={ui.gap}>
                            <Button title={t('manageStaff.finance.staffStats.editHours')} onPress={startEdit}
                                disabled={saving || editing || !Number.isSafeInteger(shift.ledger_revision)} variant="outline" size="sm" />
                            {editing ? (
                                <>
                                    <Input
                                        value={hours}
                                        onChangeText={setHours}
                                        keyboardType="decimal-pad"
                                        accessibilityLabel={t('manageStaff.finance.staffStats.editHoursPrompt')}
                                        label={t('manageStaff.finance.staffStats.editHoursPrompt')}
                                        editable={!saving && !requiresReview}
                                    />
                                    <View style={ui.wrap}>
                                        <Button title={t(saving ? 'manageStaff.finance.loading' : 'manageStaff.common.save')} onPress={() => void save()} disabled={saving || requiresReview} size="sm" />
                                        <Button title={t('manageStaff.common.cancel')} onPress={() => { setEditing(false); setRequiresReview(false); setError(null); }} disabled={saving} variant="ghost" size="sm" />
                                    </View>
                                </>
                            ) : null}
                            {requiresReview ? (
                                <Button
                                    title={t('manageStaff.finance.staffStats.discardHoursReload')}
                                    onPress={async () => { await onHoursUpdated(); setEditing(false); setRequiresReview(false); setError(null); }}
                                    disabled={saving}
                                    variant="ghost"
                                    size="sm"
                                />
                            ) : null}
                            {error ? <Text style={styles.danger}>{error}</Text> : null}
                        </View>
                    ) : null}
                    {shift.items.length === 0 ? (
                        <Text style={ui.muted}>{t('manageStaff.finance.staffStats.noClients')}</Text>
                    ) : shift.items.map((item) => (
                        <View key={item.id} style={styles.item}>
                            <Text style={ui.text}>{item.client_name || t('manageStaff.finance.staffStats.clientNotSpecified')}</Text>
                            <Text style={ui.muted}>{item.service_name || '—'}</Text>
                            <Text style={ui.muted}>
                                {t('manageStaff.finance.staffStats.amount')}: {money(item.service_amount)} · {t('manageStaff.finance.staffStats.consumables')}: {money(item.consumables_amount)}
                                {item.created_at ? ` · ${t('manageStaff.finance.staffStats.createdAt')}: ${time(item.created_at)}` : ''}
                            </Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    title: { marginTop: colors.layout.space2 },
    flex: { flex: 1 },
    audit: { paddingVertical: colors.layout.space2, borderTopWidth: 1, borderTopColor: colors.border.subtle },
    shift: {
        gap: colors.layout.space3,
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.elevated,
    },
    shiftHeader: { flexDirection: 'row' },
    shiftDate: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    success: { fontSize: 13, color: colors.status.success },
    accent: { fontSize: 13, color: colors.accent.indigo },
    danger: { fontSize: 13, color: colors.status.danger },
    item: { paddingVertical: colors.layout.space2, borderTopWidth: 1, borderTopColor: colors.border.subtle },
});
