'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type TimeOff = { id: string; date_from: string; date_to: string; reason: string | null; created_at: string | null; cancelled_at: string | null };

export default function TimeOffEditor({ staffId, onChanged }: { staffId: string; onChanged: () => Promise<unknown> }) {
    const { t } = useLanguage();
    const endpoint = `/api/staff/${staffId}/time-off`;
    const [items, setItems] = useState<TimeOff[]>([]);
    const [today, setToday] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [reason, setReason] = useState('');
    const [review, setReview] = useState(false);
    const [cancelId, setCancelId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const inFlight = useRef(false);

    const load = useCallback(async () => {
        const response = await fetch(endpoint, { cache: 'no-store' });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.message || t('scheduleForm.absenceLoadError'));
        setItems(payload.data.items);
        setToday(payload.data.today);
    }, [endpoint, t]);

    useEffect(() => { void load().catch(cause => setError(cause instanceof Error ? cause.message : t('scheduleForm.absenceLoadError'))); }, [load, t]);

    async function create() {
        if (inFlight.current) return;
        if (!from || !to || from < today || to < from ||
            (Date.parse(to) - Date.parse(from)) / 86400000 > 365) {
            setError(t('scheduleForm.absenceInvalid')); return;
        }
        if (!review) { setError(''); setNotice(''); setReview(true); return; }
        inFlight.current = true; setBusy(true); setError('');
        try {
            const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ from, to, reason }) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || t('scheduleForm.absenceSaveError'));
            setReview(false); setFrom(''); setTo(''); setReason(''); setNotice(t('scheduleForm.absenceCreated'));
            await Promise.all([load(), onChanged()]);
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('scheduleForm.absenceSaveError')); }
        finally { inFlight.current = false; setBusy(false); }
    }

    async function cancel() {
        if (!cancelId || inFlight.current) return;
        inFlight.current = true; setBusy(true); setError('');
        try {
            const response = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: cancelId }) });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.message || t('scheduleForm.absenceSaveError'));
            setCancelId(null); setNotice(t('scheduleForm.absenceCancelled'));
            await Promise.all([load(), onChanged()]);
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('scheduleForm.absenceSaveError')); }
        finally { inFlight.current = false; setBusy(false); }
    }

    return <section className="rounded-2xl border border-slate-500/30 p-4 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold">{t('scheduleForm.absenceTitle')}</h2>
        <p className="text-sm text-slate-400">{t('scheduleForm.absenceHint')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">{t('scheduleForm.absenceFrom')}<input className="rounded-lg border border-slate-500/40 bg-transparent p-2" type="date" min={today} value={from} disabled={busy} onChange={e => { setFrom(e.target.value); setReview(false); }} /></label>
            <label className="flex flex-col gap-1">{t('scheduleForm.absenceTo')}<input className="rounded-lg border border-slate-500/40 bg-transparent p-2" type="date" min={from || today} value={to} disabled={busy} onChange={e => { setTo(e.target.value); setReview(false); }} /></label>
        </div>
        <label className="flex flex-col gap-1">{t('scheduleForm.absenceReason')}<input className="rounded-lg border border-slate-500/40 bg-transparent p-2" maxLength={240} value={reason} disabled={busy} onChange={e => { setReason(e.target.value); setReview(false); }} /></label>
        {review && <div className="rounded-xl bg-indigo-500/10 p-3" role="status">{t('scheduleForm.absenceReview')} {from} — {to}. {t('scheduleForm.conflictHint')}</div>}
        <div className="flex flex-wrap gap-3">
            <button type="button" disabled={busy || !today} className="rounded-xl bg-indigo-600 px-5 py-2 text-white disabled:opacity-50" onClick={() => void create()}>{review ? t('scheduleForm.absenceConfirm') : t('scheduleForm.absenceReviewButton')}</button>
            {review && <button type="button" disabled={busy} className="underline" onClick={() => setReview(false)}>{t('scheduleForm.absenceBack')}</button>}
        </div>
        {error && <p role="alert" className="text-rose-400">{error} <button type="button" className="underline" onClick={() => void load().then(() => setError('')).catch(() => {})}>{t('scheduleForm.retry')}</button></p>}
        {notice && <p role="status" className="text-emerald-400">{notice}</p>}
        <h3 className="font-semibold">{t('scheduleForm.absenceHistory')}</h3>
        {items.length === 0 ? <p className="text-sm text-slate-400">{t('scheduleForm.absenceEmpty')}</p> : <ul className="space-y-2">{items.map(item => <li key={item.id} className="rounded-xl border border-slate-500/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span>{item.date_from} — {item.date_to}</span><span className="text-sm text-slate-400">{item.cancelled_at ? t('scheduleForm.absenceCancelledState') : t('scheduleForm.absenceActive')}</span></div>
            {item.reason && <p className="text-sm text-slate-400">{item.reason}</p>}
            {!item.cancelled_at && item.date_from >= today && <div className="mt-2">
                {cancelId === item.id ? <div className="space-x-3"><span>{t('scheduleForm.absenceCancelReview')}</span><button type="button" disabled={busy} className="text-rose-400 underline" onClick={() => void cancel()}>{t('scheduleForm.absenceCancelConfirm')}</button><button type="button" disabled={busy} className="underline" onClick={() => setCancelId(null)}>{t('scheduleForm.absenceBack')}</button></div>
                    : <button type="button" disabled={busy} className="text-indigo-400 underline" onClick={() => setCancelId(item.id)}>{t('scheduleForm.absenceCancel')}</button>}
            </div>}
        </li>)}</ul>}
    </section>;
}
