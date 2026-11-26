import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import { resolveBusinessTimeZone } from '@shared-client/timezone';

import SegmentedTabs from '../../components/SegmentedTabs';
import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import FormField from '../../components/ui/FormField';
import { KeyValueRow } from '../../components/ui/ListRow';
import MotionPressable from '../../components/ui/MotionPressable';
import Screen from '../../components/ui/Screen';
import ScreenIntro from '../../components/ui/ScreenIntro';
import Section from '../../components/ui/Section';
import { SkeletonCard, SkeletonList } from '../../components/ui/Skeleton';
import { StatGrid } from '../../components/ui/StatTile';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { radii, space, typeScale } from '../../constants/theme';
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
import { Badge, StatTile, dmy, ui } from './ui';

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
    const stepping = stats.isFetching;

    const refresh = async () => {
        setRefreshing(true);
        try { await Promise.all([stats.refetch(), audit.refetch()]); } finally { setRefreshing(false); }
    };

    let body;
    if (stats.isLoading && !stats.data) {
        body = (
            <>
                <SkeletonCard lines={2} />
                <SkeletonCard lines={3} />
            </>
        );
    } else if (stats.error && !stats.data) {
        body = (
            <ErrorState
                title={t('manageStaff.finance.error.title')}
                message={staffErrorMessage(stats.error, t('manageStaff.finance.loadError'), t)}
                retryLabel={t('manageStaff.finance.retry')}
                onRetry={() => void stats.refetch()}
            />
        );
    } else if (!stats.data) {
        body = (
            <EmptyState
                icon="stats-chart-outline"
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
                <StatGrid>
                    <StatTile label={t('manageStaff.finance.staffStats.turnover')} value={money(summary.turnover)} hint={periodLabel} />
                    <StatTile label={t('manageStaff.finance.staffStats.toEmployee')} value={money(data.totalMaster)} tone="success"
                        hint={`${formatShare(data.totalMaster, summary.turnover)} · ${t('manageStaff.finance.share.split')}`} />
                    <StatTile label={t('manageStaff.finance.staffStats.toBusiness')} value={money(data.totalSalon)} tone="accent"
                        hint={`${formatShare(data.totalSalon, summary.turnover)} · ${t('manageStaff.finance.share.split')}`} />
                    <StatTile label={t('manageStaff.finance.guarantees.title')} value={money(summary.guaranteeUsed ? summary.topup : 0)} tone="warning"
                        hint={summary.guaranteeUsed
                            ? `${t('manageStaff.finance.guarantees.baseShare')}: ${money(data.totalBaseMasterShare)}`
                            : t('manageStaff.finance.guarantees.notUsed')} />
                </StatGrid>

                <Section
                    title={t('manageStaff.finance.operational.readout')}
                    right={<StatusPill label={t(flags.length > 0 ? 'manageStaff.finance.flags.reviewNeeded' : 'manageStaff.finance.flags.stable')} tone={flags.length > 0 ? 'warning' : 'success'} />}
                >
                    <View style={ui.card}>
                        <KeyValueRow label={t('manageStaff.finance.staffStats.shifts')} value={String(data.shiftsCount)} emphasis />
                        <Text style={styles.subtle}>
                            {t('manageStaff.finance.shifts.openCount', { count: String(data.openShiftsCount) })} · {t('manageStaff.finance.shifts.closedCount', { count: String(data.closedShiftsCount) })}
                        </Text>
                        <View style={ui.hairline} />
                        <KeyValueRow label={t('manageStaff.finance.staffStats.clients')} value={String(data.totalClients)} />
                        <KeyValueRow label={t('manageStaff.finance.staffStats.consumables')} value={money(data.totalConsumables)} />
                        <KeyValueRow label={t('manageStaff.finance.staffStats.late')} value={`${data.totalLateMinutes} ${t('manageStaff.finance.minutes')}`} />
                        <KeyValueRow label={t('manageStaff.finance.period.label')} value={`${periodLabel} · ${t(`manageStaff.finance.period.${period}`)}`} />
                        {flags.length > 0 ? (
                            <View style={ui.wrap}>{flags.map((flag) => <Badge key={flag} label={flag} tone="warning" />)}</View>
                        ) : null}
                    </View>
                </Section>

                {data.shifts.length > 0 ? (
                    <Section
                        title={t('manageStaff.finance.staffStats.shiftsPeriod')}
                        right={<Badge label={translatePlural(t, 'manageStaff.shiftCount', data.shifts.length)} />}
                    >
                        {data.shifts.map((shift) => (
                            <ShiftCard key={shift.id} bizId={params.bizId} shift={shift} onHoursUpdated={() => stats.refetch()} />
                        ))}
                    </Section>
                ) : null}
            </>
        );
    }

    return (
        <Screen keyboard refreshing={refreshing} onRefresh={refresh} testID="manage-staff-finance-stats">
            {/* The header says "Статистика": one muted line names the person. */}
            {params.staffName ? <ScreenIntro>{params.staffName}</ScreenIntro> : null}

            <View style={styles.filters}>
                <SegmentedTabs
                    tabs={(['day', 'month', 'year'] as const).map((value) => ({ key: value, label: t(`manageStaff.finance.period.${value}`) }))}
                    value={period}
                    onChange={(value) => { if (!stepping) setPeriod(value); }}
                />
                <View style={styles.pager}>
                    <Pressable
                        onPress={() => setDate(shiftStatsDate(period, shownDate, -1))}
                        disabled={stepping || !shownDate}
                        accessibilityRole="button"
                        accessibilityLabel={t('manageStaff.date.previous')}
                        style={({ pressed }) => [styles.pagerButton, pressed ? ui.pressed : null, stepping || !shownDate ? ui.disabled : null]}
                    >
                        <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                    </Pressable>
                    <Text style={styles.pagerLabel} numberOfLines={1} accessibilityLiveRegion="polite">{periodLabel || '—'}</Text>
                    {date !== null ? (
                        <Pressable
                            onPress={() => setDate(null)}
                            disabled={stepping}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.pagerToday, pressed ? ui.pressed : null, stepping ? ui.disabled : null]}
                        >
                            <Text style={styles.pagerTodayText}>{t('manageStaff.date.today')}</Text>
                        </Pressable>
                    ) : null}
                    <Pressable
                        onPress={() => setDate(shiftStatsDate(period, shownDate, 1))}
                        disabled={stepping || !shownDate}
                        accessibilityRole="button"
                        accessibilityLabel={t('manageStaff.date.next')}
                        style={({ pressed }) => [styles.pagerButton, pressed ? ui.pressed : null, stepping || !shownDate ? ui.disabled : null]}
                    >
                        <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
                    </Pressable>
                </View>
            </View>

            {body}

            <Section
                title={t('manageStaff.finance.auditLog.title')}
                caption={t('manageStaff.finance.auditLog.subtitle')}
                right={<Badge label={String(audit.data?.length ?? 0)} />}
            >
                {audit.isLoading ? <SkeletonList rows={2} avatar={false} /> : null}
                {audit.error ? (
                    <ErrorState
                        compact
                        title={t('manageStaff.finance.auditLog.loadErrorTitle')}
                        message={staffErrorMessage(audit.error, t('manageStaff.loadError'), t)}
                        onRetry={() => void audit.refetch()}
                    />
                ) : null}
                {audit.data && audit.data.length === 0 ? <Text style={ui.muted}>{t('manageStaff.finance.auditLog.empty')}</Text> : null}
                {audit.data && audit.data.length > 0 ? (
                    <View style={styles.list}>
                        {audit.data.map((entry, index) => (
                            <Fragment key={entry.id}>
                                {index > 0 ? <View style={ui.hairline} /> : null}
                                <View style={styles.audit}>
                                    <View style={styles.auditTop}>
                                        <Text style={ui.strong} numberOfLines={1}>{entry.changed_by_name || t('manageStaff.finance.auditLog.unknownUser')}</Text>
                                        <Text style={ui.muted}>{formatInTimeZone(new Date(entry.changed_at), tz, 'dd.MM.yyyy HH:mm')}</Text>
                                    </View>
                                    {entry.field_changes.length > 0 ? entry.field_changes.map((change, changeIndex) => (
                                        <Text key={`${entry.id}-${changeIndex}`} style={ui.muted}>
                                            {AUDIT_FIELDS[change.field] ? t(AUDIT_FIELDS[change.field]) : change.field}: {change.old_value === null ? '—' : String(change.old_value)} → {change.new_value === null ? '—' : String(change.new_value)}
                                        </Text>
                                    )) : <Text style={ui.muted}>{entry.message || '—'}</Text>}
                                </View>
                            </Fragment>
                        ))}
                    </View>
                ) : null}
            </Section>
        </Screen>
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
                    <View style={styles.shiftTop}>
                        <Text style={styles.shiftDate}>{dmy(shift.shift_date)}</Text>
                        <StatusPill
                            label={t(shift.status === 'open' ? 'manageStaff.finance.staffStats.status.open' : 'manageStaff.finance.staffStats.status.closed')}
                            tone={shift.status === 'open' ? 'success' : 'neutral'}
                        />
                    </View>
                    <Text style={ui.muted}>
                        {translatePlural(t, 'manageStaff.clientCount', shift.items.length)}
                        {' · '}
                        {opened ? `${t('manageStaff.finance.staffStats.openedAt')}: ${opened}` : t('manageStaff.finance.shift.noOpenTime')}
                        {closed ? ` · ${t('manageStaff.finance.shift.closedAt')}: ${closed}` : ''}
                    </Text>
                    <Text style={styles.shiftTotal}>{money(shift.total_amount + shift.consumables_amount)}</Text>
                    <View style={styles.shiftSplit}>
                        <Text style={styles.success}>{t('manageStaff.finance.staffStats.toEmployee')}: {money(shiftEmployeeAmount(shift))}</Text>
                        <Text style={styles.accent}>{t('manageStaff.finance.staffStats.toBusiness')}: {money(shift.salon_share)}</Text>
                        <Text style={ui.muted}>{t('manageStaff.finance.staffStats.consumables')}: {money(shift.consumables_amount)}</Text>
                    </View>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text.tertiary} />
            </MotionPressable>
            {expanded ? (
                <View style={styles.expanded}>
                    <View style={ui.hairline} />
                    <KeyValueRow label={t('manageStaff.finance.staffStats.baseShare')} value={money(shift.base_master_share ?? shift.master_share)} />
                    <KeyValueRow label={t('manageStaff.finance.staffStats.guaranteedAmount')} value={money(shift.guaranteed_amount)} />
                    <KeyValueRow label={t('manageStaff.finance.staffStats.hours')} value={shift.hours_worked !== null ? shift.hours_worked.toFixed(2) : '—'} />
                    {shift.status === 'closed' || editing ? (
                        <View style={ui.gap}>
                            {!editing ? (
                                <Button title={t('manageStaff.finance.staffStats.editHours')} onPress={startEdit}
                                    disabled={saving || !Number.isSafeInteger(shift.ledger_revision)} variant="outline" size="sm"
                                    leadingIcon={<Ionicons name="create-outline" size={16} color={colors.text.primary} />} />
                            ) : null}
                            {editing ? (
                                <>
                                    <FormField
                                        value={hours}
                                        onChangeText={setHours}
                                        keyboardType="decimal-pad"
                                        accessibilityLabel={t('manageStaff.finance.staffStats.editHoursPrompt')}
                                        label={t('manageStaff.finance.staffStats.editHoursPrompt')}
                                        editable={!saving && !requiresReview}
                                        error={error ?? undefined}
                                        containerStyle={styles.field}
                                    />
                                    <View style={styles.formActions}>
                                        <Button title={t('manageStaff.common.cancel')} onPress={() => { setEditing(false); setRequiresReview(false); setError(null); }} disabled={saving} variant="ghost" size="sm" style={styles.secondary} />
                                        <Button title={t(saving ? 'manageStaff.finance.loading' : 'manageStaff.common.save')} onPress={() => void save()} disabled={saving || requiresReview} variant="secondary" size="sm" style={styles.primary} />
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
                            {error && !editing ? <Text style={styles.danger}>{error}</Text> : null}
                        </View>
                    ) : null}
                    <View style={ui.hairline} />
                    {shift.items.length === 0 ? (
                        <Text style={ui.muted}>{t('manageStaff.finance.staffStats.noClients')}</Text>
                    ) : shift.items.map((item, index) => (
                        <Fragment key={item.id}>
                            {index > 0 ? <View style={ui.hairline} /> : null}
                            <View style={styles.item}>
                                <View style={styles.itemTop}>
                                    <Text style={ui.strong} numberOfLines={1}>{item.client_name || t('manageStaff.finance.staffStats.clientNotSpecified')}</Text>
                                    <Text style={ui.strong}>{money(item.service_amount)}</Text>
                                </View>
                                <Text style={ui.muted}>{item.service_name || '—'}</Text>
                                <Text style={ui.muted}>
                                    {t('manageStaff.finance.staffStats.consumables')}: {money(item.consumables_amount)}
                                    {item.created_at ? ` · ${t('manageStaff.finance.staffStats.createdAt')}: ${time(item.created_at)}` : ''}
                                </Text>
                            </View>
                        </Fragment>
                    ))}
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    filters: { gap: space.md },
    pager: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    pagerButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
    },
    pagerLabel: { ...typeScale.headline, color: colors.text.primary, flex: 1, textAlign: 'center' },
    pagerToday: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
    },
    pagerTodayText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    subtle: { ...typeScale.caption, color: colors.text.tertiary, marginTop: -space.xs },
    flex: { flex: 1, gap: space.xs },
    list: { backgroundColor: colors.surface.card, borderRadius: radii.lg, paddingHorizontal: space.lg },
    audit: { paddingVertical: space.md, gap: space.xxs },
    auditTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    shift: { backgroundColor: colors.surface.card, borderRadius: radii.lg, padding: space.lg, gap: space.md },
    shiftHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    shiftTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    shiftDate: { ...typeScale.headline, color: colors.text.primary },
    shiftTotal: { ...typeScale.metric, color: colors.text.primary },
    shiftSplit: { gap: space.xxs },
    success: { ...typeScale.caption, color: colors.tone.success.fg },
    accent: { ...typeScale.caption, color: colors.tone.accent.fg },
    danger: { ...typeScale.caption, color: colors.tone.danger.fg },
    expanded: { gap: space.sm },
    field: { marginBottom: 0 },
    formActions: { flexDirection: 'row', gap: space.md },
    secondary: { flex: 1 },
    primary: { flex: 2 },
    item: { paddingVertical: space.sm, gap: space.xxs },
    itemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
