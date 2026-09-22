'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import type { TimeRange } from '@/lib/scheduling/model';

export function TimeRangesEditor({ label, ranges, change }: {
    label: string; ranges: TimeRange[]; change: (ranges: TimeRange[]) => void;
}) {
    const { t } = useLanguage();
    return <fieldset className="min-w-0 space-y-2">
        <legend className="mb-2 text-sm font-medium">{label}</legend>
        {ranges.map((range, index) => <div key={index} className="flex flex-wrap items-end gap-2">
            {(['start', 'end'] as const).map(part => <label key={part} className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
                {t(part === 'start' ? 'scheduling.start' : 'scheduling.end')}
                <input type="time" aria-label={`${label}: ${part === 'start' ? t('scheduling.start') : t('scheduling.end')} ${index + 1}`}
                    className="w-full min-w-0 rounded-lg border border-slate-500/40 bg-transparent p-2 text-base"
                    value={range[part]} onChange={e => change(ranges.map((r, i) => i === index ? { ...r, [part]: e.target.value } : r))} />
            </label>)}
            <button type="button" className="rounded-lg p-2 text-sm underline" aria-label={`${label}: ${t('scheduling.remove')} ${index + 1}`}
                onClick={() => change(ranges.filter((_, i) => i !== index))}>{t('scheduling.remove')}</button>
        </div>)}
        {ranges.length < 8 && <button type="button" className="text-sm text-indigo-400 underline"
            onClick={() => change([...ranges, { start: '', end: '' }])}>{t('scheduling.add')}</button>}
    </fieldset>;
}
