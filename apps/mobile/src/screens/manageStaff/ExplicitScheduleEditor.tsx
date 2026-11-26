import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatInTimeZone } from 'date-fns-tz';

import SegmentedTabs from '../../components/SegmentedTabs';
import { StatusPill } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import FormField from '../../components/ui/FormField';
import Section from '../../components/ui/Section';
import { SkeletonCard } from '../../components/ui/Skeleton';
import { MIN_TOUCH_TARGET } from '../../constants/accessibility';
import { colors } from '../../constants/colors';
import { layout, radii, space, typeScale } from '../../constants/theme';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useLanguage, type MobileI18nKey } from '../../i18n';
import {
    cancelTimeOff,
    createTimeOff,
    fetchBranchSchedule,
    fetchScheduleDraft,
    fetchScheduleSnapshot,
    fetchTimeOff,
    publishSchedule,
    resetScheduleDay,
} from './api';
import { staffErrorMessage } from './errors';
import { emptyDay, emptyWeek, shiftYmd, validPublishSchedule, validTimeOff, weekFromBranchHours } from './explicitSchedule';
import type { ScheduleDayPlan, ScheduleSnapshot, TimeOff, TimeRange, WeekPlan } from './types';
import { Badge, DateStepper, OptionList, TimeField, dmy, ui } from './ui';

const ISO_DAY_KEYS: Record<string, MobileI18nKey> = {
    '1': 'manageStaff.staff.schedule.dayOfWeek.monday',
    '2': 'manageStaff.staff.schedule.dayOfWeek.tuesday',
    '3': 'manageStaff.staff.schedule.dayOfWeek.wednesday',
    '4': 'manageStaff.staff.schedule.dayOfWeek.thursday',
    '5': 'manageStaff.staff.schedule.dayOfWeek.friday',
    '6': 'manageStaff.staff.schedule.dayOfWeek.saturday',
    '7': 'manageStaff.staff.schedule.dayOfWeek.sunday',
};

const SOURCE_KEYS: Record<ScheduleSnapshot['days'][number]['source'], MobileI18nKey> = {
    week: 'manageStaff.scheduleForm.week',
    day: 'manageStaff.scheduleForm.day',
    legacy: 'manageStaff.scheduleForm.legacy',
    absence: 'manageStaff.scheduleForm.absence',
    unconfigured: 'manageStaff.scheduleForm.unconfigured',
};

type Conflict = { id: string; start_at: string };

function conflictsOf(error: unknown): Conflict[] {
    const details = (error as { details?: { details?: unknown } } | null)?.details?.details;
    return Array.isArray(details) ? (details as Conflict[]) : [];
}

const ranges = (items: TimeRange[]) => items.map((range) => `${range.start}–${range.end}`).join(', ');

/**
 * The website's ScheduleEditor with explicit scheduling (SCHEDULE_V2_ENABLED): the published
 * schedule two weeks at a time, a draft of a regular week or one day, review, then publication;
 * "reset day" returns a date to the regular week. The server validates and checks bookings.
 */
export function ExplicitScheduleEditor({ bizId, staffId, branches, homeBranchId }: {
    bizId: string;
    staffId: string;
    branches: { id: string; name: string }[];
    homeBranchId: string;
}) {
    const { t } = useLanguage();
    const [from, setFrom] = useState<string | null>(null);
    const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const sequence = useRef(0);

    const [kind, setKind] = useState<'week' | 'day'>('week');
    const [draftFrom, setDraftFrom] = useState('');
    const [branchId, setBranchId] = useState(homeBranchId);
    const [days, setDays] = useState<WeekPlan>(emptyWeek);
    const [saving, setSaving] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [resetReview, setResetReview] = useState(false);
    const [notice, setNotice] = useState('');
    const [conflicts, setConflicts] = useState<Conflict[]>([]);

    const refresh = useCallback(async () => {
        const requestId = ++sequence.current;
        setLoading(true);
        setLoadError('');
        try {
            const next = await fetchScheduleSnapshot(bizId, staffId, from);
            if (requestId === sequence.current) setSnapshot(next);
        } catch (error) {
            if (requestId === sequence.current) setLoadError(staffErrorMessage(error, t('manageStaff.scheduleForm.loadError'), t));
        } finally {
            if (requestId === sequence.current) setLoading(false);
        }
    }, [bizId, staffId, from, t]);

    useEffect(() => { void refresh(); }, [refresh]);
    useEffect(() => { if (snapshot && !draftFrom) setDraftFrom(snapshot.today); }, [snapshot, draftFrom]);

    const invalidateReview = () => { setReviewing(false); setResetReview(false); };
    const changeDay = (key: string, value: ScheduleDayPlan) => { setDays((current) => ({ ...current, [key]: value })); invalidateReview(); };

    const loadCurrentPlan = async () => {
        if (!draftFrom || !snapshot) return;
        setSaving(true); setNotice(''); invalidateReview();
        try {
            const draft = await fetchScheduleDraft(bizId, staffId, kind, draftFrom);
            if (draft.revision !== snapshot.revision) throw new Error(t('manageStaff.scheduleForm.stale'));
            setDays(draft.days);
            if (draft.branchId) setBranchId(draft.branchId);
            setNotice(t(draft.source === 'unconfigured' ? 'manageStaff.scheduleForm.draftEmpty' : 'manageStaff.scheduleForm.draftLoaded'));
        } catch (error) {
            setNotice(staffErrorMessage(error, t('manageStaff.scheduleForm.planLoadError'), t));
        } finally { setSaving(false); }
    };

    const fillFromBranch = async () => {
        setSaving(true); setNotice(''); setResetReview(false);
        try {
            const rows = await fetchBranchSchedule(bizId, branchId);
            if (!rows.length) throw new Error(t('manageStaff.scheduleForm.noBranchHours'));
            setDays(weekFromBranchHours(rows));
            setReviewing(false);
            setNotice(t('manageStaff.scheduleForm.branchCopied'));
        } catch (error) {
            setNotice(staffErrorMessage(error, t('manageStaff.scheduleForm.branchHoursLoadError'), t));
        } finally { setSaving(false); }
    };

    const publish = async () => {
        if (!snapshot) return;
        setNotice(''); setConflicts([]);
        const body = { kind, from: draftFrom, branchId, expectedRevision: snapshot.revision, days };
        if (!validPublishSchedule(body)) { setNotice(t('manageStaff.scheduling.invalid')); return; }
        if (draftFrom < snapshot.today) { setNotice(t('manageStaff.scheduleForm.pastError')); return; }
        if (!reviewing) { setReviewing(true); return; }
        setSaving(true);
        try {
            await publishSchedule(bizId, staffId, body);
            setReviewing(false);
            setNotice(t('manageStaff.scheduleForm.published'));
            await refresh();
        } catch (error) {
            setConflicts(conflictsOf(error));
            setNotice(staffErrorMessage(error, t('manageStaff.scheduleForm.saveError'), t));
        } finally { setSaving(false); }
    };

    const resetDay = async () => {
        if (!snapshot || !draftFrom) return;
        if (!resetReview) { setReviewing(false); setResetReview(true); return; }
        setSaving(true); setNotice(''); setConflicts([]);
        try {
            await resetScheduleDay(bizId, staffId, draftFrom, snapshot.revision);
            setResetReview(false); setReviewing(false);
            setNotice(t('manageStaff.scheduleForm.published'));
            await refresh();
        } catch (error) {
            setConflicts(conflictsOf(error));
            const code = (error as { details?: { error?: string } } | null)?.details?.error;
            setNotice(code === 'SCHEDULE_WEEK_REQUIRED' ? t('manageStaff.scheduleForm.weekRequired') : staffErrorMessage(error, t('manageStaff.scheduleForm.saveError'), t));
        } finally { setSaving(false); }
    };

    if (loading && !snapshot) {
        return (
            <View style={styles.root}>
                <SkeletonCard lines={4} />
                <SkeletonCard lines={3} />
            </View>
        );
    }

    const busy = saving || loading;
    const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name || t('manageStaff.scheduleForm.branchUnavailable');
    const allEmpty = snapshot?.days.every((day) => day.source === 'unconfigured');
    const firstDay = snapshot ? snapshot.days[0]?.date || snapshot.today : '';
    const lastDay = snapshot ? snapshot.days[snapshot.days.length - 1]?.date || firstDay : '';

    return (
        <View style={styles.root}>
            {loadError ? (
                <ErrorState compact title={loadError} retryLabel={t('manageStaff.scheduleForm.retry')} onRetry={() => void refresh()} />
            ) : null}

            {snapshot ? (
                <Section
                    title={t('manageStaff.form.currentSchedule')}
                    caption={`${t('manageStaff.scheduleForm.time')}: ${snapshot.timezone}. ${t('manageStaff.scheduleForm.breakHint')}`}
                    actionLabel={t('manageStaff.form.refresh')}
                    onAction={() => { if (busy) return; setReviewing(false); void refresh(); }}
                >
                    <View style={styles.pager}>
                        <Pressable
                            onPress={() => setFrom(shiftYmd(firstDay, -14))}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel={t('manageStaff.scheduling.previous')}
                            style={({ pressed }) => [styles.pagerButton, pressed ? ui.pressed : null, busy ? ui.disabled : null]}
                        >
                            <Ionicons name="chevron-back" size={20} color={colors.text.primary} />
                        </Pressable>
                        <Text style={styles.pagerLabel} numberOfLines={1} accessibilityLiveRegion="polite">
                            {dmy(firstDay)} — {dmy(lastDay)}
                        </Text>
                        <Pressable
                            onPress={() => setFrom(snapshot.today)}
                            disabled={busy}
                            accessibilityRole="button"
                            style={({ pressed }) => [styles.pagerToday, pressed ? ui.pressed : null, busy ? ui.disabled : null]}
                        >
                            <Text style={styles.pagerTodayText}>{t('manageStaff.scheduling.today')}</Text>
                        </Pressable>
                        <Pressable
                            onPress={() => setFrom(shiftYmd(firstDay, 14))}
                            disabled={busy}
                            accessibilityRole="button"
                            accessibilityLabel={t('manageStaff.scheduling.next')}
                            style={({ pressed }) => [styles.pagerButton, pressed ? ui.pressed : null, busy ? ui.disabled : null]}
                        >
                            <Ionicons name="chevron-forward" size={20} color={colors.text.primary} />
                        </Pressable>
                    </View>
                    {allEmpty ? (
                        <FeedbackBanner variant="info" title={t('manageStaff.scheduleForm.emptyTitle')} message={t('manageStaff.scheduleForm.emptyHint')} compact />
                    ) : null}
                    <View style={styles.list}>
                        {snapshot.days.map((day, index) => {
                            const working = day.intervals.length > 0;
                            return (
                                <View key={day.date}>
                                    {index > 0 ? <View style={ui.hairline} /> : null}
                                    <View style={styles.snapshotRow}>
                                        <View style={styles.snapshotDate}>
                                            <Text style={ui.strong}>{dmy(day.date).slice(0, 5)}</Text>
                                            <Text style={ui.muted} numberOfLines={1}>{t(SOURCE_KEYS[day.source])}</Text>
                                        </View>
                                        <View style={styles.snapshotBody}>
                                            {working ? (
                                                <>
                                                    <Text style={ui.text}>{ranges(day.intervals)}</Text>
                                                    {day.breaks.length ? <Text style={ui.muted}>{t('manageStaff.scheduling.breaks')}: {ranges(day.breaks)}</Text> : null}
                                                    <Text style={ui.muted} numberOfLines={1}>{branchName(day.branch_id)}</Text>
                                                </>
                                            ) : day.source !== 'unconfigured' && day.source !== 'absence' ? (
                                                <Text style={ui.muted}>{t('manageStaff.scheduling.off')}</Text>
                                            ) : null}
                                        </View>
                                        {day.source === 'absence' ? <Badge label={t('manageStaff.scheduleForm.absence')} tone="warning" /> : null}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </Section>
            ) : null}

            <Section title={t('manageStaff.scheduleForm.editorTitle')} caption={t('manageStaff.scheduleForm.draftHint')}>
                <SegmentedTabs
                    tabs={(['week', 'day'] as const).map((value) => ({
                        key: value,
                        label: t(value === 'week' ? 'manageStaff.scheduleForm.regularWeek' : 'manageStaff.scheduleForm.specificDay'),
                    }))}
                    value={kind}
                    onChange={(value) => {
                        if (saving) return;
                        setKind(value);
                        setDays(value === 'week' ? emptyWeek() : emptyDay());
                        invalidateReview();
                    }}
                />
                <View style={ui.card}>
                    {draftFrom ? (
                        <DateStepper
                            label={t(kind === 'week' ? 'manageStaff.scheduleForm.effectiveFrom' : 'manageStaff.scheduleForm.date')}
                            value={draftFrom}
                            onChange={(value) => { setDraftFrom(value); invalidateReview(); }}
                            min={snapshot?.today}
                            today={snapshot?.today}
                            disabled={saving}
                        />
                    ) : null}
                    <View style={ui.hairline} />
                    <Text style={ui.label}>{t('manageStaff.scheduleForm.branch')}</Text>
                    <OptionList options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} value={branchId} onChange={(value) => { setBranchId(value); invalidateReview(); }} disabled={saving} />
                </View>
                <View style={styles.tools}>
                    {kind === 'week' ? (
                        <Button
                            title={t('manageStaff.scheduleForm.copyBranch')}
                            onPress={() => void fillFromBranch()}
                            disabled={saving}
                            variant="ghost"
                            size="sm"
                            leadingIcon={<Ionicons name="copy-outline" size={16} color={colors.text.primary} />}
                        />
                    ) : null}
                    <Button
                        title={t('manageStaff.scheduleForm.loadPlan')}
                        onPress={() => void loadCurrentPlan()}
                        disabled={saving || !draftFrom}
                        variant="ghost"
                        size="sm"
                        leadingIcon={<Ionicons name="download-outline" size={16} color={colors.text.primary} />}
                    />
                </View>
                {kind === 'day' ? (
                    <View style={ui.inset}>
                        {resetReview ? <Text style={ui.text}>{t('manageStaff.scheduleForm.resetReview', { date: dmy(draftFrom) })}</Text> : null}
                        <Button
                            title={t(resetReview ? 'manageStaff.scheduleForm.resetConfirm' : 'manageStaff.scheduleForm.resetDay')}
                            onPress={() => void resetDay()}
                            disabled={!snapshot || !draftFrom || draftFrom < snapshot.today || busy || !!loadError}
                            variant="outline"
                            size="sm"
                        />
                        {resetReview ? <Button title={t('manageStaff.common.cancel')} onPress={() => setResetReview(false)} variant="ghost" size="sm" /> : null}
                    </View>
                ) : null}
                {Object.entries(days).map(([key, day]) => (
                    <View key={key} style={ui.card}>
                        <View style={styles.dayHeader}>
                            <Text style={styles.dayTitle}>
                                {key === 'day' ? t('manageStaff.scheduleForm.selectedDay') : t(ISO_DAY_KEYS[key])}
                            </Text>
                            {!day.intervals.length ? <StatusPill label={t('manageStaff.scheduling.off')} tone="neutral" /> : null}
                        </View>
                        <RangesEditor label={t('manageStaff.scheduling.work')} ranges={day.intervals} disabled={saving} onChange={(intervals) => changeDay(key, { ...day, intervals })} />
                        <RangesEditor label={t('manageStaff.scheduling.breaks')} ranges={day.breaks} disabled={saving} onChange={(breaks) => changeDay(key, { ...day, breaks })} />
                    </View>
                ))}
                {reviewing ? (
                    <FeedbackBanner
                        variant="info"
                        message={`${t(kind === 'week' ? 'manageStaff.scheduleForm.willPublishWeek' : 'manageStaff.scheduleForm.willPublishDay')} ${dmy(draftFrom)}. ${t('manageStaff.scheduleForm.branch')}: ${branchName(branchId)}.${kind === 'week' ? ` ${t('manageStaff.scheduleForm.overrideHint')}` : ''}\n${t('manageStaff.scheduleForm.conflictHint')}`}
                    />
                ) : null}
                {notice ? <Text style={ui.text} accessibilityLiveRegion="polite">{notice}</Text> : null}
                {conflicts.length > 0 ? (
                    <View style={ui.inset}>
                        {conflicts.map((conflict) => (
                            <Text key={conflict.id} style={ui.muted}>
                                • {t('manageStaff.scheduleForm.booking')} {formatInTimeZone(new Date(conflict.start_at), snapshot?.timezone || 'UTC', 'dd.MM.yyyy HH:mm')} — {conflict.id.slice(0, 8)}
                            </Text>
                        ))}
                    </View>
                ) : null}
                <Button
                    title={t(saving ? 'manageStaff.scheduleForm.save' : reviewing ? 'manageStaff.scheduleForm.confirm' : 'manageStaff.scheduleForm.review')}
                    onPress={() => void publish()}
                    disabled={saving || loading || !!loadError || !snapshot}
                    loading={saving}
                    fullWidth
                />
            </Section>

            <TimeOffEditor bizId={bizId} staffId={staffId} onChanged={refresh} />
        </View>
    );
}

function RangesEditor({ label, ranges: items, onChange, disabled }: {
    label: string;
    ranges: TimeRange[];
    onChange: (ranges: TimeRange[]) => void;
    disabled?: boolean;
}) {
    const { t } = useLanguage();
    return (
        <View style={styles.ranges}>
            <Text style={ui.label}>{label}</Text>
            {items.map((range, index) => (
                <View key={index} style={ui.row}>
                    <TimeField
                        value={range.start}
                        label={`${label}: ${t('manageStaff.scheduling.start')} ${index + 1}`}
                        disabled={disabled}
                        onChange={(start) => onChange(items.map((item, position) => (position === index ? { ...item, start } : item)))}
                    />
                    <Text style={ui.muted}>–</Text>
                    <TimeField
                        value={range.end}
                        label={`${label}: ${t('manageStaff.scheduling.end')} ${index + 1}`}
                        disabled={disabled}
                        onChange={(end) => onChange(items.map((item, position) => (position === index ? { ...item, end } : item)))}
                    />
                    <Pressable
                        onPress={() => onChange(items.filter((_, position) => position !== index))}
                        disabled={disabled}
                        accessibilityRole="button"
                        accessibilityLabel={`${label}: ${t('manageStaff.scheduling.remove')} ${index + 1}`}
                        style={({ pressed }) => [styles.remove, pressed ? ui.pressed : null, disabled ? ui.disabled : null]}
                    >
                        <Ionicons name="close" size={20} color={colors.tone.danger.fg} />
                    </Pressable>
                </View>
            ))}
            {items.length < 8 ? (
                <Button
                    title={t('manageStaff.scheduling.add')}
                    onPress={() => onChange([...items, { start: '', end: '' }])}
                    disabled={disabled}
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Ionicons name="add" size={16} color={colors.tone.accent.fg} />}
                    textStyle={styles.addText}
                    style={styles.add}
                />
            ) : null}
        </View>
    );
}

/** The website's TimeOffEditor: the staff member's absences, created and cancelled after review. */
function TimeOffEditor({ bizId, staffId, onChanged }: { bizId: string; staffId: string; onChanged: () => Promise<unknown> }) {
    const { t } = useLanguage();
    const { confirm } = useConfirm();
    const [items, setItems] = useState<TimeOff[]>([]);
    const [today, setToday] = useState('');
    const [from, setFromDate] = useState('');
    const [to, setTo] = useState('');
    const [reason, setReason] = useState('');
    const [review, setReview] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const inFlight = useRef(false);

    const load = useCallback(async () => {
        const data = await fetchTimeOff(bizId, staffId);
        setItems(data.items);
        setToday(data.today);
        setFromDate((value) => value || data.today);
        setTo((value) => value || data.today);
    }, [bizId, staffId]);

    useEffect(() => {
        void load().catch((cause) => setError(staffErrorMessage(cause, t('manageStaff.scheduleForm.absenceLoadError'), t)));
    }, [load, t]);

    const create = async () => {
        if (inFlight.current) return;
        if (!validTimeOff(from, to, today)) { setError(t('manageStaff.scheduleForm.absenceInvalid')); return; }
        if (!review) { setError(''); setNotice(''); setReview(true); return; }
        inFlight.current = true; setBusy(true); setError('');
        try {
            await createTimeOff(bizId, staffId, { from, to, reason });
            setReview(false); setReason(''); setNotice(t('manageStaff.scheduleForm.absenceCreated'));
            await Promise.all([load(), onChanged()]);
        } catch (cause) {
            setError(staffErrorMessage(cause, t('manageStaff.scheduleForm.absenceSaveError'), t));
        } finally { inFlight.current = false; setBusy(false); }
    };

    const cancel = async (item: TimeOff) => {
        if (inFlight.current) return;
        const accepted = await confirm({
            title: t('manageStaff.scheduleForm.absenceCancel'),
            message: `${t('manageStaff.scheduleForm.absenceCancelReview')} ${dmy(item.date_from)} — ${dmy(item.date_to)}`,
            confirmLabel: t('manageStaff.scheduleForm.absenceCancelConfirm'),
            cancelLabel: t('manageStaff.scheduleForm.absenceBack'),
            variant: 'danger',
        });
        if (!accepted) return;
        inFlight.current = true; setBusy(true); setError('');
        try {
            await cancelTimeOff(bizId, staffId, item.id);
            setNotice(t('manageStaff.scheduleForm.absenceCancelled'));
            await Promise.all([load(), onChanged()]);
        } catch (cause) {
            setError(staffErrorMessage(cause, t('manageStaff.scheduleForm.absenceSaveError'), t));
        } finally { inFlight.current = false; setBusy(false); }
    };

    return (
        <Section title={t('manageStaff.scheduleForm.absenceTitle')} caption={t('manageStaff.scheduleForm.absenceHint')}>
            <View style={ui.card}>
                {today ? (
                    <>
                        <DateStepper label={t('manageStaff.scheduleForm.absenceFrom')} value={from || today} min={today} today={today} disabled={busy}
                            onChange={(value) => { setFromDate(value); if (to < value) setTo(value); setReview(false); }} />
                        <DateStepper label={t('manageStaff.scheduleForm.absenceTo')} value={to || from || today} min={from || today} disabled={busy}
                            onChange={(value) => { setTo(value); setReview(false); }} />
                    </>
                ) : null}
                <FormField label={t('manageStaff.scheduleForm.absenceReason')} value={reason} maxLength={240} editable={!busy}
                    onChangeText={(value) => { setReason(value); setReview(false); }} containerStyle={styles.reason} />
                {review ? <FeedbackBanner variant="info" message={`${t('manageStaff.scheduleForm.absenceReview')} ${dmy(from)} — ${dmy(to)}. ${t('manageStaff.scheduleForm.conflictHint')}`} compact /> : null}
                <View style={styles.formActions}>
                    {review ? <Button title={t('manageStaff.scheduleForm.absenceBack')} onPress={() => setReview(false)} disabled={busy} variant="ghost" style={styles.secondary} /> : null}
                    <Button
                        title={t(review ? 'manageStaff.scheduleForm.absenceConfirm' : 'manageStaff.scheduleForm.absenceReviewButton')}
                        onPress={() => void create()}
                        disabled={busy || !today}
                        loading={busy}
                        variant="secondary"
                        style={styles.primary}
                    />
                </View>
            </View>
            {error ? (
                <FeedbackBanner variant="danger" message={error} compact
                    action={<Button title={t('manageStaff.scheduleForm.retry')} size="sm" variant="outline" onPress={() => void load().then(() => setError('')).catch(() => {})} />} />
            ) : null}
            {notice ? <FeedbackBanner variant="success" message={notice} compact /> : null}
            <Text style={ui.label}>{t('manageStaff.scheduleForm.absenceHistory')}</Text>
            {items.length === 0 ? (
                <Text style={ui.muted}>{t('manageStaff.scheduleForm.absenceEmpty')}</Text>
            ) : (
                <View style={styles.list}>
                    {items.map((item, index) => (
                        <View key={item.id}>
                            {index > 0 ? <View style={ui.hairline} /> : null}
                            <View style={styles.absence}>
                                <View style={styles.absenceBody}>
                                    <Text style={ui.strong}>{dmy(item.date_from)} — {dmy(item.date_to)}</Text>
                                    {item.reason ? <Text style={ui.muted}>{item.reason}</Text> : null}
                                </View>
                                <Badge
                                    label={t(item.cancelled_at ? 'manageStaff.scheduleForm.absenceCancelledState' : 'manageStaff.scheduleForm.absenceActive')}
                                    tone={item.cancelled_at ? 'muted' : 'warning'}
                                />
                            </View>
                            {!item.cancelled_at && item.date_from >= today ? (
                                <Button
                                    title={t('manageStaff.scheduleForm.absenceCancel')}
                                    onPress={() => void cancel(item)}
                                    disabled={busy}
                                    variant="ghost"
                                    size="sm"
                                    textStyle={styles.dangerText}
                                    style={styles.absenceCancel}
                                />
                            ) : null}
                        </View>
                    ))}
                </View>
            )}
        </Section>
    );
}

const styles = StyleSheet.create({
    root: { gap: layout.sectionGap },
    pager: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    pagerButton: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.fill.input,
    },
    pagerLabel: { ...typeScale.bodyStrong, color: colors.text.primary, flex: 1, textAlign: 'center' },
    pagerToday: {
        minHeight: MIN_TOUCH_TARGET,
        justifyContent: 'center',
        paddingHorizontal: space.md,
        borderRadius: radii.md,
        backgroundColor: colors.tone.accent.bg,
    },
    pagerTodayText: { ...typeScale.callout, fontWeight: '600', color: colors.tone.accent.fg },
    list: { backgroundColor: colors.surface.card, borderRadius: radii.lg, paddingHorizontal: space.lg },
    snapshotRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingVertical: space.md },
    snapshotDate: { width: 92, gap: space.xxs },
    snapshotBody: { flex: 1, gap: space.xxs },
    tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
    dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
    dayTitle: { ...typeScale.headline, color: colors.text.primary },
    ranges: { gap: space.sm },
    remove: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.md,
        backgroundColor: colors.tone.danger.bg,
    },
    add: { alignSelf: 'flex-start', paddingHorizontal: space.sm },
    addText: { color: colors.tone.accent.fg },
    reason: { marginBottom: 0 },
    formActions: { flexDirection: 'row', gap: space.md },
    secondary: { flex: 1 },
    primary: { flex: 2 },
    absence: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingTop: space.md, paddingBottom: space.sm },
    absenceBody: { flex: 1, gap: space.xxs },
    absenceCancel: { alignSelf: 'flex-start', paddingHorizontal: 0, marginBottom: space.xs },
    dangerText: { color: colors.tone.danger.fg },
});
