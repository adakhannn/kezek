'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ScheduleDays, SchedulePeriodNav, useScheduleSnapshot } from './ScheduleCalendar';
import TimeOffEditor from './TimeOffEditor';
import { TimeRangesEditor as Ranges } from './TimeRangesEditor';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { emptyWeek, validatePublishSchedule, type ScheduleDay, type WeekPlan } from '@/lib/scheduling/model';

const field = 'rounded-lg border border-slate-500/40 bg-transparent p-2 min-w-0';


export default function ScheduleEditor({ staffId, branches, homeBranchId }: {
    staffId: string; branches: { id: string; name: string }[]; homeBranchId: string;
}) {
    const { t, locale } = useLanguage();
    const endpoint = `/api/staff/${staffId}/schedule`;
    const { snapshot, loading, error, refresh, showPeriod } = useScheduleSnapshot(endpoint);
    const [kind, setKind] = useState<'week' | 'day'>('week');
    const [from, setFrom] = useState('');
    const [branchId, setBranch] = useState(homeBranchId);
    const [days, setDays] = useState<WeekPlan>(emptyWeek);
    const [saving, setSaving] = useState(false);
    const [reviewing, setReviewing] = useState(false);
    const [resetReview, setResetReview] = useState(false);
    const [notice, setNotice] = useState('');
    const [conflicts, setConflicts] = useState<{ id: string; start_at: string }[]>([]);
    useEffect(() => { if (snapshot && !from) setFrom(snapshot.today); }, [snapshot, from]);

    function changeDay(key: string, value: ScheduleDay) {
        setDays(previous => ({ ...previous, [key]: value })); setReviewing(false); setResetReview(false);
    }

    async function resetDay() {
        if (!snapshot || !from) return;
        if (!resetReview) { setReviewing(false); setResetReview(true); return; }
        setSaving(true); setNotice(''); setConflicts([]);
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reset-day', from, expectedRevision: snapshot.revision }) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                if (Array.isArray(payload.details)) setConflicts(payload.details);
                throw new Error(payload.error === 'SCHEDULE_WEEK_REQUIRED'
                    ? t('scheduleForm.weekRequired') : payload.message || t('scheduleForm.saveError'));
            }
            setResetReview(false); setReviewing(false); setNotice(t('scheduleForm.published')); await refresh();
        } catch (cause) { setNotice(cause instanceof Error ? cause.message : t('scheduleForm.genericError')); }
        finally { setSaving(false); }
    }

    async function loadCurrentPlan() {
        if (!from || !snapshot) return;
        setSaving(true); setNotice(''); setReviewing(false); setResetReview(false);
        try {
            const response = await fetch(`${endpoint}?draftKind=${kind}&draftDate=${encodeURIComponent(from)}`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось загрузить план.');
            if (payload.data.revision !== snapshot.revision) throw new Error(t('scheduleForm.stale', "График уже изменён. Обновите действующий график и повторите загрузку."));
            setDays(payload.data.days);
            if (payload.data.branchId) setBranch(payload.data.branchId);
            setNotice(payload.data.source === 'unconfigured'
                ? t('scheduleForm.draftEmpty', "Действующий план не назначен. Черновик пустой: задайте рабочие часы.")
                : t('scheduleForm.draftLoaded', "Действующий план загружен в черновик. Изменения ещё не опубликованы."));
        } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Ошибка загрузки.'); }
        finally { setSaving(false); }
    }

    async function fillFromBranch() {
        setSaving(true); setNotice(''); setResetReview(false);
        try {
            const response = await fetch(`/api/branches/${branchId}/schedule`, { cache: 'no-store' });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось загрузить часы филиала.');
            const rows = payload.data?.schedule ?? payload.schedule;
            if (!Array.isArray(rows) || !rows.length) throw new Error(t('scheduleForm.noBranchHours'));
            const draft = emptyWeek();
            for (const row of rows) draft[String(row.day_of_week === 0 ? 7 : row.day_of_week)] = { intervals: row.intervals ?? [], breaks: row.breaks ?? [] };
            setDays(draft); setReviewing(false); setNotice(t('scheduleForm.branchCopied', "Заполнен только черновик. Проверьте дни и перерывы перед применением."));
        } catch (cause) { setNotice(cause instanceof Error ? cause.message : 'Ошибка загрузки.'); }
        finally { setSaving(false); }
    }

    async function publish() {
        if (!snapshot) return;
        setNotice(''); setConflicts([]);
        const body = { kind, from, branchId, expectedRevision: snapshot.revision, days };
        try { validatePublishSchedule(body); }
        catch { setNotice(t('scheduling.invalid')); return; }
        if (from < snapshot.today) { setNotice(t('scheduleForm.pastError', "Нельзя изменять прошедшие дни.")); return; }
        if (!reviewing) { setReviewing(true); return; }
        setSaving(true);
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                if (Array.isArray(payload.details)) setConflicts(payload.details);
                throw new Error(payload.message || t('scheduleForm.saveError', "График не сохранён."));
            }
            setReviewing(false); setNotice(t('scheduleForm.published', "График опубликован.")); await refresh();
        } catch (cause) { setNotice(cause instanceof Error ? cause.message : t('scheduleForm.genericError', "Ошибка сохранения.")); }
        finally { setSaving(false); }
    }

    if (loading && !snapshot) return <p role="status">{t('scheduleForm.loading', "Загружаем график…")}</p>;
    return <section className="space-y-6">
        {error && <p role="alert">{error}</p>}
        <button className="text-sm underline" disabled={loading || saving} onClick={() => { setReviewing(false); void refresh(); }}>{t('scheduleForm.refresh', "Обновить действующий график")}</button>
        {snapshot && <><SchedulePeriodNav snapshot={snapshot} disabled={loading || saving} change={showPeriod} />
            <ScheduleDays snapshot={snapshot} branches={branches} /></>}
        <form className="rounded-2xl border border-slate-500/30 p-4 sm:p-6 space-y-5" onSubmit={e => { e.preventDefault(); void publish(); }}>
            <h2 className="text-xl font-semibold">{t('scheduleForm.editorTitle', "Настройка графика")}</h2>
            <p className="text-sm text-slate-400">{t('scheduleForm.draftHint', "Изменения в форме — черновик. Записи клиентов не отменяются. Существующие исключения на даты сохраняются.")}</p>
            <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
                <div className="grid gap-4 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">{t('scheduleForm.change', "Что изменить")}<select className={field} value={kind} onChange={e => {
                        const value = e.target.value as 'week' | 'day'; setKind(value); setDays(value === 'week' ? emptyWeek() : { day: { intervals: [], breaks: [] } }); setReviewing(false); setResetReview(false);
                    }}><option value="week">{t('scheduleForm.regularWeek', "Обычная неделя")}</option><option value="day">{t('scheduleForm.specificDay', "Конкретный день")}</option></select></label>
                    <label className="flex flex-col gap-1">{kind === 'week' ? t('scheduleForm.effectiveFrom', "Действует с") : t('scheduleForm.date', "Дата")}<input className={field} type="date" min={snapshot?.today} required value={from} onChange={e => { setFrom(e.target.value); setReviewing(false); setResetReview(false); }} /></label>
                    <label className="flex flex-col gap-1">{t('scheduleForm.branch', "Филиал")}<select className={field} value={branchId} onChange={e => { setBranch(e.target.value); setReviewing(false); setResetReview(false); }}>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                </div>
                {kind === 'week' && <button type="button" className="text-indigo-400 underline" onClick={() => void fillFromBranch()}>{t('scheduleForm.copyBranch', "Заполнить черновик по часам филиала")}</button>}
                {branchId && <Link className="block text-indigo-400 underline" href={`/dashboard/branches/${branchId}`}>{t('scheduleForm.configureBranch')}</Link>}
                <button type="button" disabled={!from} className="block text-indigo-400 underline" onClick={() => void loadCurrentPlan()}>{t('scheduleForm.loadPlan', "Загрузить действующий план в черновик")}</button>
                {kind === 'day' && <div className="rounded-xl border border-slate-500/30 p-3 space-y-2">
                    {resetReview && <p role="status">{locale === 'ru' ? `Для ${from} будет применена обычная неделя. История сохранится; отсутствие сотрудника останется в силе.` : locale === 'ky' ? `${from}: кадимки жумалык график колдонулат. Тарых жана жок болуу сакталат.` : `The regular week will apply on ${from}. History and absences are preserved.`}</p>}
                    <button type="button" disabled={!snapshot || !from || from < snapshot.today || loading || !!error} className="text-indigo-400 underline" onClick={() => void resetDay()}>
                        {resetReview ? (locale === 'ru' ? 'Подтвердить возврат обычного графика' : locale === 'ky' ? 'Кадимки графикти кайтарууну ырастоо' : 'Confirm restoring regular schedule') : (locale === 'ru' ? 'Вернуть обычный график на эту дату' : locale === 'ky' ? 'Бул күнгө кадимки графикти кайтаруу' : 'Restore regular schedule on this date')}
                    </button>
                    {resetReview && <button type="button" className="ml-3 underline" onClick={() => setResetReview(false)}>{locale === 'ru' ? 'Отмена' : locale === 'ky' ? 'Жокко чыгаруу' : 'Cancel'}</button>}
                </div>}
                {Object.entries(days).map(([key, day]) => <div key={key} className="rounded-xl border border-slate-500/30 p-4 space-y-3">
                    <h3 className="font-semibold">{key === 'day' ? t('scheduleForm.selectedDay', 'Выбранный день') : new Intl.DateTimeFormat(locale === 'ky' ? 'ky-KG' : locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + Number(key))))}{!day.intervals.length && ` — ${t('scheduling.off', 'Выходной')}`}</h3>
                    <Ranges label={t('scheduling.work', 'Рабочее время')} ranges={day.intervals} change={intervals => changeDay(key, { ...day, intervals })} />
                    <Ranges label={t('scheduling.breaks', 'Перерывы')} ranges={day.breaks} change={breaks => changeDay(key, { ...day, breaks })} />
                </div>)}
            </fieldset>
            {reviewing && <div className="rounded-xl bg-indigo-500/10 p-4" role="status">
                {kind === 'week' ? t('scheduleForm.willPublishWeek') : t('scheduleForm.willPublishDay')} {from}. {t('scheduleForm.branch', 'Филиал')}: {branches.find(b => b.id === branchId)?.name}.
                {kind === 'week' && t('scheduleForm.overrideHint')}
                <p>{t('scheduleForm.conflictHint', "При конфликте с существующими записями изменение не будет применено.")}</p>
            </div>}
            {notice && <p role="status">{notice}</p>}
            {conflicts.length > 0 && <ul className="list-disc pl-5">{conflicts.map(c => <li key={c.id}>{t('scheduleForm.booking', 'Запись')} {new Date(c.start_at).toLocaleString(locale, { timeZone: snapshot?.timezone })} — {c.id.slice(0, 8)}</li>)}</ul>}
            <button disabled={saving || loading || !!error || !snapshot} className="rounded-xl bg-indigo-600 px-5 py-3 text-white disabled:opacity-50" type="submit">
                {saving ? t('scheduleForm.save', "Сохраняем…") : reviewing ? t('scheduleForm.confirm', "Подтвердить и опубликовать") : t('scheduleForm.review', "Проверить изменения")}
            </button>
        </form>
        <TimeOffEditor staffId={staffId} onChanged={refresh} />
    </section>;
}
