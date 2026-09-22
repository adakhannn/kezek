'use client';

import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TimeRangesEditor } from '@/components/scheduling/TimeRangesEditor';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { validateScheduleDay, type ScheduleDay } from '@/lib/scheduling/model';

type Row = ScheduleDay & { day_of_week: number };
type Props = {
    bizId: string; branchId: string;
    initialSchedule?: Array<{ day_of_week: number; intervals?: ScheduleDay['intervals']; breaks?: ScheduleDay['breaks'] }>;
    apiBase?: string;
};

export function BranchScheduleEditor({ bizId, branchId, initialSchedule = [], apiBase }: Props) {
    const { t, locale } = useLanguage();
    const [days, setDays] = useState<Row[]>(() => [1, 2, 3, 4, 5, 6, 0].map(day => {
        const saved = initialSchedule.find(row => row.day_of_week === day);
        return { day_of_week: day, intervals: saved?.intervals?.map(r => ({ ...r })) ?? [],
            breaks: saved?.breaks?.map(r => ({ ...r })) ?? [] };
    }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    function change(index: number, value: ScheduleDay) {
        setDays(previous => previous.map((day, i) => i === index ? { ...day, ...value } : day));
        setSuccess(false); setError('');
    }

    async function save() {
        setError(''); setSuccess(false);
        try { days.forEach(validateScheduleDay); }
        catch { setError(t('scheduling.invalid')); return; }
        setSaving(true);
        try {
            const path = apiBase ? `${apiBase}/${encodeURIComponent(branchId)}/schedule`
                : `/admin/api/businesses/${bizId}/branches/${branchId}/schedule`;
            const response = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' },
                credentials: 'include', body: JSON.stringify({ schedule: days }) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || payload.error || t('branches.schedule.error.server'));
            setSuccess(true);
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('branches.schedule.error.server')); }
        finally { setSaving(false); }
    }

    return <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div>
            <h3 className="text-lg font-semibold">{t('branches.schedule.title')}</h3>
            <p className="mt-2 text-sm text-slate-400">{t('scheduling.branchHint')}</p>
        </div>
        <fieldset disabled={saving} className="grid min-w-0 gap-4 lg:grid-cols-2 disabled:opacity-60">
            {days.map((day, index) => {
                const label = new Intl.DateTimeFormat(locale === 'ky' ? 'ky-KG' : locale, { weekday: 'long', timeZone: 'UTC' })
                    .format(new Date(Date.UTC(2026, 0, 4 + day.day_of_week)));
                return <section key={day.day_of_week} aria-label={label} className="min-w-0 space-y-4 rounded-xl border border-slate-500/30 p-4">
                    <h4 className="font-semibold capitalize">{label}{!day.intervals.length && ` — ${t('scheduling.closed')}`}</h4>
                    <TimeRangesEditor label={t('scheduling.work')} ranges={day.intervals}
                        change={intervals => change(index, { ...day, intervals, breaks: intervals.length ? day.breaks : [] })} />
                    {day.intervals.length > 0 && <TimeRangesEditor label={t('scheduling.breaks')} ranges={day.breaks}
                        change={breaks => change(index, { ...day, breaks })} />}
                </section>;
            })}
        </fieldset>
        {error && <AlertBanner variant="danger" message={error} />}
        {success && <AlertBanner variant="success" message={t('branches.schedule.success')} />}
        <Button type="submit" disabled={saving} isLoading={saving}>{t('branches.schedule.saveButton')}</Button>
    </form>;
}
