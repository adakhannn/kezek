import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatInTimeZone } from 'date-fns-tz';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import { colors } from '../../constants/colors';
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
import { Badge, Chip, DateStepper, OptionList, SectionTitle, TimeField, dmy, ui } from './ui';

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

    if (loading && !snapshot) return <Text style={ui.muted}>{t('manageStaff.scheduleForm.loading')}</Text>;

    const busy = saving || loading;
    const branchName = (id: string | null) => branches.find((branch) => branch.id === id)?.name || t('manageStaff.scheduleForm.branchUnavailable');
    const allEmpty = snapshot?.days.every((day) => day.source === 'unconfigured');

    return (
        <View style={ui.gap}>
            {loadError ? (
                <FeedbackBanner variant="danger" message={loadError} action={<Button title={t('manageStaff.scheduleForm.retry')} onPress={() => void refresh()} size="sm" variant="outline" />} />
            ) : null}
            <Button title={t('manageStaff.scheduleForm.refresh')} onPress={() => { setReviewing(false); void refresh(); }} disabled={busy} variant="ghost" />

            {snapshot ? (
                <Card style={ui.gap}>
                    <View style={ui.wrap}>
                        <Chip label={t('manageStaff.scheduling.previous')} selected={false} disabled={busy} onPress={() => setFrom(shiftYmd(snapshot.days[0]?.date || snapshot.today, -14))} />
                        <Chip label={t('manageStaff.scheduling.today')} selected={false} disabled={busy} onPress={() => setFrom(snapshot.today)} />
                        <Chip label={t('manageStaff.scheduling.next')} selected={false} disabled={busy} onPress={() => setFrom(shiftYmd(snapshot.days[0]?.date || snapshot.today, 14))} />
                    </View>
                    {allEmpty ? (
                        <FeedbackBanner variant="info" title={t('manageStaff.scheduleForm.emptyTitle')} message={t('manageStaff.scheduleForm.emptyHint')} />
                    ) : null}
                    <Text style={ui.muted}>{t('manageStaff.scheduleForm.time')}: {snapshot.timezone}. {t('manageStaff.scheduleForm.breakHint')}</Text>
                    {snapshot.days.map((day) => (
                        <View key={day.date} style={styles.snapshotDay}>
                            <Text style={styles.dayTitle}>{dmy(day.date)}</Text>
                            <Text style={ui.muted}>{t(SOURCE_KEYS[day.source])}</Text>
                            {day.intervals.length ? (
                                <>
                                    <Text style={ui.text}>{ranges(day.intervals)}</Text>
                                    {day.breaks.length ? <Text style={ui.muted}>{t('manageStaff.scheduling.breaks')}: {ranges(day.breaks)}</Text> : null}
                                    <Text style={ui.muted}>{branchName(day.branch_id)}</Text>
                                </>
                            ) : day.source !== 'unconfigured' && day.source !== 'absence' ? (
                                <Text style={ui.text}>{t('manageStaff.scheduling.off')}</Text>
                            ) : null}
                        </View>
                    ))}
                </Card>
            ) : null}

            <Card style={ui.gap}>
                <SectionTitle title={t('manageStaff.scheduleForm.editorTitle')} description={t('manageStaff.scheduleForm.draftHint')} />
                <Text style={ui.label}>{t('manageStaff.scheduleForm.change')}</Text>
                <View style={ui.wrap}>
                    {(['week', 'day'] as const).map((value) => (
                        <Chip
                            key={value}
                            label={t(value === 'week' ? 'manageStaff.scheduleForm.regularWeek' : 'manageStaff.scheduleForm.specificDay')}
                            selected={kind === value}
                            disabled={saving}
                            onPress={() => { setKind(value); setDays(value === 'week' ? emptyWeek() : emptyDay()); invalidateReview(); }}
                        />
                    ))}
                </View>
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
                <Text style={ui.label}>{t('manageStaff.scheduleForm.branch')}</Text>
                <OptionList options={branches.map((branch) => ({ value: branch.id, label: branch.name }))} value={branchId} onChange={(value) => { setBranchId(value); invalidateReview(); }} disabled={saving} />
                {kind === 'week' ? <Button title={t('manageStaff.scheduleForm.copyBranch')} onPress={() => void fillFromBranch()} disabled={saving} variant="ghost" /> : null}
                <Button title={t('manageStaff.scheduleForm.loadPlan')} onPress={() => void loadCurrentPlan()} disabled={saving || !draftFrom} variant="ghost" />
                {kind === 'day' ? (
                    <View style={styles.resetBox}>
                        {resetReview ? <Text style={ui.text}>{t('manageStaff.scheduleForm.resetReview', { date: dmy(draftFrom) })}</Text> : null}
                        <Button
                            title={t(resetReview ? 'manageStaff.scheduleForm.resetConfirm' : 'manageStaff.scheduleForm.resetDay')}
                            onPress={() => void resetDay()}
                            disabled={!snapshot || !draftFrom || draftFrom < snapshot.today || busy || !!loadError}
                            variant="outline"
                        />
                        {resetReview ? <Button title={t('manageStaff.common.cancel')} onPress={() => setResetReview(false)} variant="ghost" /> : null}
                    </View>
                ) : null}
                {Object.entries(days).map(([key, day]) => (
                    <View key={key} style={styles.planDay}>
                        <Text style={styles.dayTitle}>
                            {key === 'day' ? t('manageStaff.scheduleForm.selectedDay') : t(ISO_DAY_KEYS[key])}
                            {!day.intervals.length ? ` — ${t('manageStaff.scheduling.off')}` : ''}
                        </Text>
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
                    <View>
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
            </Card>

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
                    <Text style={ui.text}>—</Text>
                    <TimeField
                        value={range.end}
                        label={`${label}: ${t('manageStaff.scheduling.end')} ${index + 1}`}
                        disabled={disabled}
                        onChange={(end) => onChange(items.map((item, position) => (position === index ? { ...item, end } : item)))}
                    />
                    <Button
                        title={t('manageStaff.scheduling.remove')}
                        onPress={() => onChange(items.filter((_, position) => position !== index))}
                        disabled={disabled}
                        variant="ghost"
                        size="sm"
                        accessibilityLabel={`${label}: ${t('manageStaff.scheduling.remove')} ${index + 1}`}
                    />
                </View>
            ))}
            {items.length < 8 ? (
                <Button title={t('manageStaff.scheduling.add')} onPress={() => onChange([...items, { start: '', end: '' }])} disabled={disabled} variant="ghost" size="sm" />
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
        <Card style={ui.gap}>
            <SectionTitle title={t('manageStaff.scheduleForm.absenceTitle')} description={t('manageStaff.scheduleForm.absenceHint')} />
            {today ? (
                <>
                    <DateStepper label={t('manageStaff.scheduleForm.absenceFrom')} value={from || today} min={today} today={today} disabled={busy}
                        onChange={(value) => { setFromDate(value); if (to < value) setTo(value); setReview(false); }} />
                    <DateStepper label={t('manageStaff.scheduleForm.absenceTo')} value={to || from || today} min={from || today} disabled={busy}
                        onChange={(value) => { setTo(value); setReview(false); }} />
                </>
            ) : null}
            <Input label={t('manageStaff.scheduleForm.absenceReason')} value={reason} maxLength={240} editable={!busy}
                onChangeText={(value) => { setReason(value); setReview(false); }} />
            {review ? <FeedbackBanner variant="info" message={`${t('manageStaff.scheduleForm.absenceReview')} ${dmy(from)} — ${dmy(to)}. ${t('manageStaff.scheduleForm.conflictHint')}`} /> : null}
            <Button
                title={t(review ? 'manageStaff.scheduleForm.absenceConfirm' : 'manageStaff.scheduleForm.absenceReviewButton')}
                onPress={() => void create()}
                disabled={busy || !today}
                loading={busy}
                fullWidth
            />
            {review ? <Button title={t('manageStaff.scheduleForm.absenceBack')} onPress={() => setReview(false)} disabled={busy} variant="ghost" /> : null}
            {error ? (
                <FeedbackBanner variant="danger" message={error}
                    action={<Button title={t('manageStaff.scheduleForm.retry')} size="sm" variant="outline" onPress={() => void load().then(() => setError('')).catch(() => {})} />} />
            ) : null}
            {notice ? <FeedbackBanner variant="success" message={notice} /> : null}
            <Text style={styles.dayTitle}>{t('manageStaff.scheduleForm.absenceHistory')}</Text>
            {items.length === 0 ? <Text style={ui.muted}>{t('manageStaff.scheduleForm.absenceEmpty')}</Text> : items.map((item) => (
                <View key={item.id} style={styles.snapshotDay}>
                    <View style={ui.row}>
                        <Text style={ui.text}>{dmy(item.date_from)} — {dmy(item.date_to)}</Text>
                        <Badge label={t(item.cancelled_at ? 'manageStaff.scheduleForm.absenceCancelledState' : 'manageStaff.scheduleForm.absenceActive')} tone={item.cancelled_at ? 'muted' : 'warning'} />
                    </View>
                    {item.reason ? <Text style={ui.muted}>{item.reason}</Text> : null}
                    {!item.cancelled_at && item.date_from >= today ? (
                        <Button title={t('manageStaff.scheduleForm.absenceCancel')} onPress={() => void cancel(item)} disabled={busy} variant="ghost" size="sm" />
                    ) : null}
                </View>
            ))}
        </Card>
    );
}


const styles = StyleSheet.create({
    snapshotDay: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.card,
        gap: 2,
    },
    dayTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary },
    planDay: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        gap: colors.layout.space2,
    },
    ranges: { gap: colors.layout.space2 },
    resetBox: {
        padding: colors.layout.space3,
        borderRadius: colors.layout.radiusMd,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        gap: colors.layout.space2,
    },
});
