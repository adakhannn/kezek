'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import type { ScheduleSnapshot } from '@/lib/scheduling/model';

export function useScheduleSnapshot(endpoint: string) {
    const { t } = useLanguage();
    const [from, showPeriod] = useState('');
    const sequence = useRef(0);
    const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const refresh = useCallback(async (signal?: AbortSignal) => {
        const requestId = ++sequence.current;
        setLoading(true); setError('');
        try {
            const path = from ? `${endpoint}${endpoint.includes('?') ? '&' : '?'}from=${encodeURIComponent(from)}` : endpoint;
            const response = await fetch(path, { cache: 'no-store', signal });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || t('scheduleForm.loadError', "Не удалось загрузить график."));
            if (!signal?.aborted && requestId === sequence.current) setSnapshot(payload.data);
        } catch (cause) {
            if (!signal?.aborted && requestId === sequence.current) setError(cause instanceof Error ? cause.message : t('scheduleForm.loadError', "Не удалось загрузить график."));
        } finally { if (!signal?.aborted && requestId === sequence.current) setLoading(false); }
    }, [endpoint, from, t]);
    useEffect(() => {
        const controller = new AbortController(); void refresh(controller.signal);
        return () => controller.abort();
    }, [refresh]);
    return { snapshot, error, loading, refresh, showPeriod };
}

export default function ScheduleCalendar({ endpoint, branches }: { endpoint: string; branches: { id: string; name: string }[] }) {
    const { t } = useLanguage();
    const { snapshot, error, loading, refresh, showPeriod } = useScheduleSnapshot(endpoint);
    if (loading) return <p role="status">{t('scheduleForm.loading', "Загружаем график…")}</p>;
    if (error) return <div role="alert">{error} <button onClick={() => void refresh()}>{t('scheduleForm.retry', "Повторить")}</button></div>;
    if (!snapshot) return null;
    return <div className="space-y-4"><SchedulePeriodNav snapshot={snapshot} change={showPeriod} />
        <ScheduleDays snapshot={snapshot} branches={branches} /></div>;
}

export function SchedulePeriodNav({ snapshot, change, disabled = false }: {
    snapshot: ScheduleSnapshot; change: (from: string) => void; disabled?: boolean;
}) {
    const { t } = useLanguage();
    const start = snapshot.days[0]?.date || snapshot.today;
    function move(offset: number) {
        const date = new Date(`${start}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() + offset);
        change(date.toISOString().slice(0, 10));
    }
    return <nav className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-lg border border-slate-500/30 p-2 text-sm" disabled={disabled} onClick={() => move(-14)}>{t('scheduling.previous')}</button>
        <button type="button" className="rounded-lg border border-slate-500/30 p-2 text-sm" disabled={disabled} onClick={() => change(snapshot.today)}>{t('scheduling.today')}</button>
        <button type="button" className="rounded-lg border border-slate-500/30 p-2 text-sm" disabled={disabled} onClick={() => move(14)}>{t('scheduling.next')}</button>
    </nav>;
}

export function ScheduleDays({ snapshot, branches }: { snapshot: ScheduleSnapshot; branches: { id: string; name: string }[] }) {
    const { t } = useLanguage();
    const allEmpty = snapshot.days.every(day => day.source === 'unconfigured');
    return <div className="space-y-4">
        {allEmpty && <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
            <h2 className="font-semibold">{t('scheduleForm.emptyTitle', "График пока не назначен")}</h2>
            <p>{t('scheduleForm.emptyHint', "Руководитель назначит рабочие часы. До этого запись клиентов недоступна.")}</p>
        </div>}
        <p className="text-sm text-slate-400">{t('scheduleForm.time', 'Время')}: {snapshot.timezone}. {t('scheduleForm.breakHint', 'Перерывы недоступны для записи.')}</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {snapshot.days.map(day => <article key={day.date} className="rounded-xl border border-slate-500/30 p-4">
                <h3 className="font-semibold">{day.date.split('-').reverse().join('.')}</h3>
                <p className="text-sm text-slate-400">{{ week: t('scheduleForm.week', "Обычный график"), day: t('scheduleForm.day', "Исключение на день"), legacy: t('scheduleForm.legacy', "Ранее назначенный график"), absence: t('scheduleForm.absence', "Отсутствие"), unconfigured: t('scheduleForm.unconfigured', "График не назначен") }[day.source]}</p>
                {day.intervals.length ? <>
                    <p className="mt-2 font-medium">{day.intervals.map(r => `${r.start}–${r.end}`).join(', ')}</p>
                    {day.breaks.length > 0 && <p className="text-sm">{t('scheduling.breaks', 'Перерывы')}: {day.breaks.map(r => `${r.start}–${r.end}`).join(', ')}</p>}
                    <p className="text-sm">{branches.find(b => b.id === day.branch_id)?.name || t('scheduleForm.branchUnavailable', "Филиал недоступен")}</p>
                </> : day.source !== 'unconfigured' && day.source !== 'absence' ? <p className="mt-2">{t('scheduling.off', 'Выходной')}</p> : null}
            </article>)}
        </div>
    </div>;
}
