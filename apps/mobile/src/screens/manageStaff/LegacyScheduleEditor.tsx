import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fromZonedTime } from 'date-fns-tz';

import SegmentedTabs from '../../components/SegmentedTabs';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import { colors } from '../../constants/colors';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import { logWarn } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { addDaysYmd, businessTodayYmd, businessWeekYmds } from '../../utils/businessWeek';
import {
    branchDayIntervals,
    branchScheduleRows,
    dayDraft,
    dayRuleValues,
    legacyScheduleWriteMessageKey,
    nextYmd,
    planBranchSchedule,
    weekdayOf,
    winningRules,
    withEnd,
    withStart,
} from './legacySchedule';
import type { BranchHoursRow, LegacyRule, TimeRange } from './types';
import { Badge, OptionList, SectionTitle, TimeField, ToggleRow, dmy, ui } from './ui';

type Props = {
    bizId: string;
    staffId: string;
    branches: { id: string; name: string }[];
    homeBranchId: string;
    tz: string;
    branchHours: BranchHoursRow[] | null;
    hasRegularSchedule: boolean;
};

const DAY_KEYS: MobileI18nKey[] = [
    'manageStaff.staff.schedule.dayOfWeek.sunday',
    'manageStaff.staff.schedule.dayOfWeek.monday',
    'manageStaff.staff.schedule.dayOfWeek.tuesday',
    'manageStaff.staff.schedule.dayOfWeek.wednesday',
    'manageStaff.staff.schedule.dayOfWeek.thursday',
    'manageStaff.staff.schedule.dayOfWeek.friday',
    'manageStaff.staff.schedule.dayOfWeek.saturday',
];

/**
 * The website's legacy schedule editor (FE-02): this week and next, one rule per day, a temporary
 * transfer to another branch per day, "apply branch hours" for the days from today. Reads and
 * writes staff_schedule_rules with the user's session, as the website does (RLS and the database
 * guards decide).
 */
export function LegacyScheduleEditor({ bizId, staffId, branches, homeBranchId, tz, branchHours, hasRegularSchedule }: Props) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const { showToast } = useToast();
    const [tab, setTab] = useState<'schedule' | 'transfers'>('schedule');
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [rules, setRules] = useState<Map<string, LegacyRule>>(new Map());
    const [saving, setSaving] = useState(false);

    const currentWeek = useMemo(() => businessWeekYmds(0, tz), [tz]);
    const nextWeek = useMemo(() => businessWeekYmds(1, tz), [tz]);
    const windowDates = useMemo(() => [...currentWeek, ...nextWeek], [currentWeek, nextWeek]);

    const load = useCallback(async () => {
        const { data, error } = await supabase
            .from('staff_schedule_rules')
            .select('id, date_on, intervals, branch_id')
            .eq('biz_id', bizId)
            .eq('staff_id', staffId)
            .eq('kind', 'date')
            .eq('is_active', true)
            .gte('date_on', windowDates[0])
            .lte('date_on', windowDates[windowDates.length - 1])
            .order('date_on', { ascending: true })
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) {
            logWarn('ManageStaffSchedule', 'Failed to load schedule rules', error);
            setStatus('error');
            return;
        }
        setRules(winningRules(data ?? [], homeBranchId));
        setStatus('ready');
    }, [bizId, staffId, homeBranchId, windowDates]);

    useEffect(() => { void load(); }, [load]);

    const applyBranchSchedule = async () => {
        const result = planBranchSchedule(windowDates, businessTodayYmd(tz), rules, homeBranchId, branchHours);
        if (!result.ok) { showToast(t(result.error), 'error'); return; }
        const { plan } = result;
        if (plan.dates.length === 0) { showToast(t('manageStaff.staff.schedule.nothingToApply'), 'info'); return; }
        if (plan.overwrite > 0 || plan.keptTransfers > 0) {
            const accepted = await confirm({
                title: t('manageStaff.staff.schedule.applyBranchConfirm.title'),
                message: t('manageStaff.staff.schedule.applyBranchConfirm.message', {
                    days: String(plan.dates.length), overwrite: String(plan.overwrite), kept: String(plan.keptTransfers),
                }),
                confirmLabel: t('manageStaff.staff.schedule.applyBranch'),
                cancelLabel: t('manageStaff.staff.schedule.applyBranchConfirm.cancel'),
            });
            if (!accepted) return;
        }
        if (status !== 'ready' || !branchHours || branchHours.length === 0) return;
        setSaving(true);
        try {
            const rows = branchScheduleRows(plan, { bizId, staffId, homeBranchId, tz }, rules, branchHours);
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .upsert(rows, { onConflict: 'id', defaultToNull: false })
                .select('id');
            if (error) throw error;
            if ((data ?? []).length !== rows.length) throw Object.assign(new Error('SCHEDULE_PARTIAL_WRITE'), { code: 'PGRST116' });
            showToast(t('manageStaff.staff.schedule.branchApplied', { count: String(rows.length) }), 'success');
            await load();
        } catch (error) {
            logWarn('ManageStaffSchedule', 'Error applying branch schedule', error);
            showToast(t(legacyScheduleWriteMessageKey(error)), 'error');
        } finally {
            setSaving(false);
        }
    };

    const saveDay = async (date: string, interval: TimeRange | null, branchId: string) => {
        if (status !== 'ready') return;
        if (date < businessTodayYmd(tz)) { showToast(t('manageStaff.staff.schedule.pastDateLocked'), 'error'); return; }
        setSaving(true);
        try {
            const existing = rules.get(date);
            if (existing && existing.branch_id !== homeBranchId && existing.branch_id !== branchId) {
                // bookings_branch_guard: a transfer day with bookings cannot move away from its branch.
                const { count, error } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq('staff_id', staffId)
                    .eq('branch_id', existing.branch_id)
                    .gte('start_at', fromZonedTime(`${date}T00:00:00`, tz).toISOString())
                    .lt('start_at', `${nextYmd(date)}T00:00:00.000Z`);
                if (error) throw error;
                if ((count ?? 0) > 0) { showToast(t('manageStaff.staff.schedule.transferHasBookings'), 'error'); return; }
            }
            const values = dayRuleValues(interval, branchId);
            // .single() turns "no row changed" (hidden by RLS or already gone) into PGRST116.
            const { error } = existing
                ? await supabase.from('staff_schedule_rules').update(values)
                    .eq('id', existing.id).eq('biz_id', bizId).eq('staff_id', staffId).select('id').single()
                : await supabase.from('staff_schedule_rules')
                    .insert({ ...values, biz_id: bizId, staff_id: staffId, kind: 'date', date_on: date, tz, priority: 0 })
                    .select('id').single();
            if (error) throw error;
            showToast(t('manageStaff.staff.schedule.saved'), 'success');
            await load();
        } catch (error) {
            logWarn('ManageStaffSchedule', 'Error saving schedule', error);
            showToast(t(legacyScheduleWriteMessageKey(error)), 'error');
        } finally {
            setSaving(false);
        }
    };

    const today = businessTodayYmd(tz);
    const renderWeek = (title: MobileI18nKey, dates: string[], showApply: boolean) => (
        <Card style={ui.gap}>
            <SectionTitle title={t(title)} description={`${dmy(dates[0])} — ${dmy(dates[6])}`} />
            {showApply ? (
                <Button
                    title={t(saving ? 'manageStaff.staff.schedule.applying' : 'manageStaff.staff.schedule.applyBranch')}
                    onPress={() => void applyBranchSchedule()}
                    disabled={saving}
                    variant="outline"
                    fullWidth
                />
            ) : null}
            {dates.map((date) => {
                const rule = rules.get(date);
                return (
                    <DayRow
                        key={JSON.stringify([date, rule?.intervals ?? null, rule?.branch_id ?? null, homeBranchId])}
                        date={date}
                        today={today}
                        rule={rule}
                        branches={branches}
                        homeBranchId={homeBranchId}
                        branchIntervals={branchHours ? branchDayIntervals(branchHours, date) : undefined}
                        hasRegularSchedule={hasRegularSchedule}
                        saving={saving}
                        onSave={(interval, branchId) => void saveDay(date, interval, branchId)}
                    />
                );
            })}
        </Card>
    );

    return (
        <View style={ui.gap}>
            <SegmentedTabs
                tabs={[
                    { key: 'schedule', label: t('manageStaff.staff.schedule.tab.schedule') },
                    { key: 'transfers', label: t('manageStaff.staff.schedule.tab.transfers') },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'schedule' && status === 'loading' ? <Text style={ui.muted}>{t('manageStaff.staff.schedule.loading')}</Text> : null}
            {tab === 'schedule' && status === 'error' ? (
                <FeedbackBanner
                    variant="danger"
                    message={t('manageStaff.staff.schedule.loadError')}
                    action={<Button title={t('manageStaff.staff.schedule.retry')} onPress={() => { setStatus('loading'); void load(); }} size="sm" variant="outline" />}
                />
            ) : null}
            {tab === 'schedule' && status === 'ready' ? (
                <>
                    {renderWeek('manageStaff.staff.schedule.week.current', currentWeek, true)}
                    {renderWeek('manageStaff.staff.schedule.week.next', nextWeek, false)}
                    <FeedbackBanner
                        variant="info"
                        title={t('manageStaff.staff.schedule.instructions.title')}
                        message={[
                            t('manageStaff.staff.schedule.instructions.default'),
                            t('manageStaff.staff.schedule.instructions.dayOff'),
                            `${t('manageStaff.staff.schedule.instructions.transfer.prefix')} ${t('manageStaff.staff.schedule.instructions.transfer.suffix')}`,
                            t('manageStaff.staff.schedule.instructions.weeks'),
                            t('manageStaff.staff.schedule.instructions.past'),
                            t('manageStaff.staff.schedule.instructions.transfersTab'),
                        ].map((line) => `• ${line}`).join('\n')}
                    />
                </>
            ) : null}
            {tab === 'transfers' ? (
                <TransfersList bizId={bizId} staffId={staffId} branches={branches} homeBranchId={homeBranchId} tz={tz} />
            ) : null}
        </View>
    );
}

function DayRow({ date, today, rule, branches, homeBranchId, branchIntervals, hasRegularSchedule, saving, onSave }: {
    date: string;
    today: string;
    rule: LegacyRule | undefined;
    branches: { id: string; name: string }[];
    homeBranchId: string;
    branchIntervals: TimeRange[] | undefined;
    hasRegularSchedule: boolean;
    saving: boolean;
    onSave: (interval: TimeRange | null, branchId: string) => void;
}) {
    const { t } = useLanguage();
    const draft = useMemo(() => dayDraft(rule, branchIntervals, homeBranchId), [rule, branchIntervals, homeBranchId]);
    const [dayOff, setDayOff] = useState(draft.dayOff);
    const [interval, setRange] = useState<TimeRange>(draft.interval);
    const [branchId, setBranchId] = useState(draft.branchId);
    const past = date < today;
    const isToday = date === today;
    const locked = saving || past;
    const homeLabel = t('manageStaff.staff.schedule.homeBranch');
    const dayName = t(DAY_KEYS[weekdayOf(date)]);

    return (
        <View style={[styles.day, isToday ? styles.dayToday : null, past ? styles.dayPast : null]} testID={`legacy-day-${date}`}>
            <View style={styles.dayHeader}>
                <View style={styles.dayTitle}>
                    <View style={ui.row}>
                        <Text style={styles.dayName}>{dayName}</Text>
                        {isToday ? <Badge label={t('manageStaff.staff.schedule.today')} tone="accent" /> : null}
                    </View>
                    <Text style={ui.muted}>{dmy(date)}</Text>
                    {draft.unsaved ? (
                        <Text style={styles.unsaved}>
                            {t(hasRegularSchedule ? 'manageStaff.staff.schedule.unsaved.regular' : 'manageStaff.staff.schedule.unsaved.none')}
                        </Text>
                    ) : null}
                </View>
                <Button
                    title={t(saving ? 'manageStaff.staff.schedule.saving' : 'manageStaff.staff.schedule.save')}
                    onPress={() => onSave(dayOff ? null : interval, branchId)}
                    disabled={locked}
                    size="sm"
                    accessibilityLabel={`${t('manageStaff.staff.schedule.save')}: ${dayName} ${dmy(date)}`}
                />
            </View>
            <ToggleRow
                label={past ? `${t('manageStaff.staff.schedule.dayOff')} (${t('manageStaff.staff.schedule.pastDateUnavailable')})` : t('manageStaff.staff.schedule.dayOff')}
                value={dayOff}
                onChange={setDayOff}
                disabled={locked}
            />
            {!dayOff ? (
                <View>
                    <Text style={ui.label}>{t('manageStaff.staff.schedule.workingHours')}</Text>
                    <View style={ui.row}>
                        <TimeField
                            value={interval.start}
                            onChange={(value) => setRange((current) => withStart(current, value))}
                            label={`${t('manageStaff.staff.schedule.workingHours')} ${dayName}: ${t('manageStaff.scheduling.start')}`}
                            disabled={locked}
                        />
                        <Text style={ui.text}>—</Text>
                        <TimeField
                            value={interval.end}
                            onChange={(value) => setRange((current) => withEnd(current, value))}
                            label={`${t('manageStaff.staff.schedule.workingHours')} ${dayName}: ${t('manageStaff.scheduling.end')}`}
                            disabled={locked}
                        />
                    </View>
                </View>
            ) : null}
            {branches.length > 1 ? (
                <View style={styles.transfer}>
                    <View style={ui.row}>
                        <Text style={ui.label}>{t('manageStaff.staff.schedule.temporaryTransfer')}</Text>
                        {branchId !== homeBranchId ? <Badge label={t('manageStaff.staff.schedule.active')} tone="accent" /> : null}
                    </View>
                    <OptionList
                        options={branches.map((branch) => ({
                            value: branch.id,
                            label: branch.id === homeBranchId ? `${branch.name} (${homeLabel})` : branch.name,
                        }))}
                        value={branchId}
                        onChange={setBranchId}
                        disabled={locked}
                    />
                    {!past ? (
                        <Text style={ui.muted}>
                            {branchId !== homeBranchId
                                ? `✓ ${t('manageStaff.staff.schedule.transferHint', { branch: branches.find((branch) => branch.id === branchId)?.name ?? '' })}`
                                : t('manageStaff.staff.schedule.selectBranchForTransfer')}
                        </Text>
                    ) : null}
                </View>
            ) : (
                <Text style={ui.muted}>{t('manageStaff.staff.schedule.noBranchesForTransfer')}</Text>
            )}
        </View>
    );
}

/** The "temporary transfers" tab: the days of both weeks at another branch. */
function TransfersList({ bizId, staffId, branches, homeBranchId, tz }: {
    bizId: string;
    staffId: string;
    branches: { id: string; name: string }[];
    homeBranchId: string;
    tz: string;
}) {
    const { t } = useLanguage();
    const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; rows: { id: string; date_on: string; branch_name: string }[] }>({ status: 'loading', rows: [] });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setState({ status: 'loading', rows: [] });
            const weekStart = businessWeekYmds(0, tz)[0];
            const weekEnd = addDaysYmd(businessWeekYmds(1, tz)[6], 1);
            const { data, error } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .neq('branch_id', homeBranchId)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });
            if (ignore) return;
            // FE-08: a failed read is an error with a retry, not "no temporary transfers".
            if (error) { setState({ status: 'error', rows: [] }); return; }
            const rows = (data ?? []).flatMap((row: { id: string; date_on: string; branch_id: string }) => {
                const branch = branches.find((item) => item.id === row.branch_id);
                return branch ? [{ id: row.id, date_on: row.date_on, branch_name: branch.name }] : [];
            });
            setState({ status: 'ready', rows });
        })();
        return () => { ignore = true; };
    }, [bizId, staffId, homeBranchId, branches, tz, attempt]);

    const today = businessTodayYmd(tz);
    const homeName = branches.find((branch) => branch.id === homeBranchId)?.name || t('manageStaff.staff.schedule.transfers.homeBranchDefault');

    return (
        <Card style={ui.gap}>
            <SectionTitle title={t('manageStaff.staff.schedule.transfers.title')} description={t('manageStaff.staff.schedule.transfers.subtitle')} />
            {state.status === 'loading' ? <Text style={ui.muted}>{t('manageStaff.staff.schedule.transfers.loading')}</Text> : null}
            {state.status === 'error' ? (
                <FeedbackBanner
                    variant="danger"
                    message={t('manageStaff.staff.schedule.transfers.loadError')}
                    action={<Button title={t('manageStaff.staff.schedule.retry')} onPress={() => setAttempt((value) => value + 1)} size="sm" variant="outline" />}
                />
            ) : null}
            {state.status === 'ready' && state.rows.length === 0 ? (
                <View>
                    <Text style={ui.text}>{t('manageStaff.staff.schedule.transfers.empty.title')}</Text>
                    <Text style={ui.muted}>{t('manageStaff.staff.schedule.transfers.empty.desc')}</Text>
                </View>
            ) : null}
            {state.status === 'ready' && state.rows.length > 0 ? (
                <>
                    <Text style={ui.muted}>{t('manageStaff.staff.schedule.transfers.homeBranch')} {homeName}</Text>
                    {state.rows.map((row) => (
                        <View key={row.id} style={[styles.transferRow, row.date_on === today ? styles.dayToday : null, row.date_on < today ? styles.dayPast : null]}>
                            <View style={ui.row}>
                                <Text style={styles.dayName}>{dmy(row.date_on)}</Text>
                                {row.date_on === today ? <Badge label={t('manageStaff.staff.schedule.today')} tone="accent" /> : null}
                                {row.date_on < today ? <Text style={ui.muted}>{t('manageStaff.staff.schedule.transfers.past')}</Text> : null}
                            </View>
                            <Text style={ui.muted}>{t('manageStaff.staff.schedule.transfers.transferred')}: {row.branch_name}</Text>
                        </View>
                    ))}
                </>
            ) : null}
            <FeedbackBanner
                variant="info"
                title={t('manageStaff.staff.schedule.transfers.instructions.title')}
                message={[
                    t('manageStaff.staff.schedule.transfers.instructions.setup'),
                    t('manageStaff.staff.schedule.transfers.instructions.select'),
                    t('manageStaff.staff.schedule.transfers.instructions.oneDay'),
                    t('manageStaff.staff.schedule.transfers.instructions.otherDays'),
                ].map((line) => `• ${line}`).join('\n')}
            />
        </Card>
    );
}

const styles = StyleSheet.create({
    day: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
        gap: colors.layout.space2,
    },
    dayToday: { borderColor: colors.accent.primary, backgroundColor: colors.surface.emphasis },
    dayPast: { opacity: 0.7 },
    dayHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: colors.layout.space2 },
    dayTitle: { flex: 1 },
    dayName: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    unsaved: { fontSize: 12, fontWeight: '600', color: colors.status.warning, marginTop: 2 },
    transfer: { gap: colors.layout.space2, borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: colors.layout.space2 },
    transferRow: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
    },
});
