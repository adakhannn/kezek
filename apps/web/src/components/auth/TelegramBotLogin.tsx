'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Dialog } from '@/components/ui/Dialog';

type Attempt = { token: string; botDeepLink: string; code: string; expiresAt: string };
type LoginState = { status: string; account?: { id: number; name: string | null } | null };
export function safeTelegramLoginRedirect(value: string, origin: string) {
    try {
        const url = new URL(value, origin);
        return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/';
    } catch { return '/'; }
}
async function requestLogin(body: object, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    const timeout = setTimeout(abort, 15000);
    try {
        const response = await fetch('/api/auth/telegram/web-login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body), cache: 'no-store', signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || 'Не удалось связаться с сервером.');
        return result.data;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export function TelegramBotLogin({ redirectTo = '/' }: { redirectTo?: string }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [state, setState] = useState<LoginState>({ status: 'pending' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const busyRef = useRef(false);
    const alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const buttonClass = 'min-h-12 w-full rounded-xl bg-[#229ED9] px-4 py-3 text-center font-semibold text-white disabled:opacity-50';
    async function start() {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true); setOpen(true); setError('');
        try {
            if (attempt) await requestLogin({ action: 'cancel', token: attempt.token }).catch(() => {});
            setAttempt(null); setState({ status: 'pending' });
            const next = await requestLogin({ action: 'create' });
            if (alive.current) setAttempt(next);
        } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : t('auth.botLogin.error')); }
        finally { busyRef.current = false; if (alive.current) setBusy(false); }
    }
    function close() {
        if (busyRef.current) return;
        if (attempt) void requestLogin({ action: 'cancel', token: attempt.token }).catch(() => {});
        setOpen(false); setAttempt(null); setError('');
    }
    useEffect(() => {
        if (!open || !attempt || state.status !== 'pending') return;
        const controller = new AbortController();
        let timer: ReturnType<typeof setTimeout>;
        let failures = 0;
        async function poll() {
            if (controller.signal.aborted) return;
            if (Date.parse(attempt!.expiresAt) <= Date.now()) { setState({ status: 'expired' }); return; }
            if (document.hidden) { timer = setTimeout(poll, 3000); return; }
            try {
                const next = await requestLogin({ action: 'status', token: attempt!.token }, controller.signal);
                if (controller.signal.aborted) return;
                setState(next); setError(''); failures = 0;
                if (next.status !== 'pending') return;
            } catch {
                if (controller.signal.aborted) return;
                failures++; setError(t('auth.botLogin.retrying'));
            }
            timer = setTimeout(poll, Math.min(15000, 3000 * 2 ** failures));
        }
        timer = setTimeout(poll, 1500);
        return () => { controller.abort(); clearTimeout(timer); };
    }, [open, attempt, state.status, t]);
    async function finish() {
        if (busyRef.current || !attempt || !state.account) return;
        busyRef.current = true; setBusy(true); setError('');
        try {
            await requestLogin({ action: 'finish', token: attempt.token, telegramId: state.account.id });
            if (alive.current) window.location.assign(safeTelegramLoginRedirect(redirectTo, window.location.origin));
        } catch (e) {
            if (alive.current) { setError(e instanceof Error ? e.message : t('auth.botLogin.error')); setState({ status: 'failed' }); }
        } finally { busyRef.current = false; if (alive.current) setBusy(false); }
    }
    return <>
        <button type="button" className={buttonClass} onClick={start} disabled={busy}>{t('auth.botLogin.title')}</button>
        {open && createPortal(<div className="fixed inset-0 z-[130]">
            <Dialog open onClose={close} title={t('auth.botLogin.title')} dismissible={!busy}>
                <div className="space-y-4">
                    {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
                    {busy && <p role="status">{t('auth.botLogin.loading')}</p>}
                    {attempt && state.status === 'pending' && <>
                        <p>{t('auth.botLogin.instructions')}</p>
                        <p className="text-center font-mono text-2xl">{attempt.code}</p>
                        <div className="mx-auto w-fit rounded-xl bg-white p-3"><QRCodeSVG value={attempt.botDeepLink} size={160} title={t('auth.botLogin.open')} /></div>
                        <a className={`${buttonClass} block`} href={attempt.botDeepLink} target="_blank" rel="noopener noreferrer">{t('auth.botLogin.open')}</a>
                        <p role="status" className="text-sm text-[var(--text-secondary)]">{t('auth.botLogin.waiting')}</p>
                    </>}
                    {state.status === 'approved' && state.account && <>
                        <p>{t('auth.botLogin.account')}</p>
                        <p className="break-words font-semibold">{state.account.name || 'Telegram'} <span className="text-sm">(ID: {state.account.id})</span></p>
                        <button type="button" className={buttonClass} disabled={busy} onClick={finish}>{t('auth.botLogin.finish')}</button>
                    </>}
                    {['expired', 'cancelled', 'consumed'].includes(state.status) && <p role="status">{t('auth.botLogin.closed')}</p>}
                    {!busy && <button type="button" className="min-h-11 w-full text-[var(--accent-primary)] underline" onClick={start}>{t('auth.botLogin.new')}</button>}
                </div>
            </Dialog>
        </div>, document.body)}
    </>;
}
