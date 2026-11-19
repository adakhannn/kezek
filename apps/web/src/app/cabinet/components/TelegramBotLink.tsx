'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Dialog } from '@/components/ui/Dialog';

type Attempt = { token: string; expiresAt: string; botDeepLink: string };
type LinkState = { status: string; account?: { id: number; name: string | null; username: string | null } | null };
type Translate = (key: string, fallback?: string) => string;
async function requestLink(t: Translate, body: object, signal?: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 15000);
    try {
        const response = await fetch('/api/auth/telegram/profile-link', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body), signal: controller.signal, cache: 'no-store',
        });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.message || t('cabinet.telegramLink.serverError', 'Не удалось связаться с сервером. Попробуйте ещё раз.'));
        return result.data;
    } finally {
        clearTimeout(timeout); signal?.removeEventListener('abort', abort);
    }
}

export function TelegramBotLink({ onSuccess }: { onSuccess: () => void }) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [attempt, setAttempt] = useState<Attempt | null>(null);
    const [state, setState] = useState<LinkState>({ status: 'pending' });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [pollFailed, setPollFailed] = useState(false);
    const busyRef = useRef(false);
    const activeRef = useRef(true);
    const successRef = useRef(onSuccess);
    successRef.current = onSuccess;
    // The cancel callback and the status poll read the current translator without restarting.
    const tRef = useRef(t);
    tRef.current = t;
    useEffect(() => { activeRef.current = true; return () => { activeRef.current = false; }; }, []);

    const cancel = useCallback(() => {
        if (busyRef.current) return;
        if (attempt) void requestLink(tRef.current, { action: 'cancel', token: attempt.token }).catch(() => {});
        setOpen(false); setAttempt(null); setError('');
    }, [attempt]);

    async function start() {
        if (busyRef.current) return;
        busyRef.current = true; setBusy(true); setError(''); setPollFailed(false); setOpen(true);
        try {
            // Invalidate the previous choice before requesting a different account.
            if (attempt) await requestLink(t, { action: 'cancel', token: attempt.token });
            setAttempt(null); setState({ status: 'pending' });
            const next: Attempt = await requestLink(t, { action: 'create' });
            if (!activeRef.current) return;
            setState({ status: 'pending' }); setAttempt(next);
        } catch (e) { if (activeRef.current) setError(e instanceof Error ? e.message : t('cabinet.telegramLink.createError', 'Не удалось создать ссылку')); }
        finally { busyRef.current = false; if (activeRef.current) setBusy(false); }
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
                const result: LinkState = await requestLink(tRef.current, { action: 'status', token: attempt!.token }, controller.signal);
                if (controller.signal.aborted) return;
                failures = 0; setPollFailed(false); setState(result);
                if (result.status !== 'pending') return;
            } catch {
                if (controller.signal.aborted) return;
                failures++;
                setPollFailed(true);
            }
            timer = setTimeout(poll, Math.min(3000 * 2 ** failures, 15000));
        }
        void poll();
        return () => { controller.abort(); clearTimeout(timer); };
    }, [open, attempt, state.status]);

    async function finish() {
        if (!attempt || !state.account || busyRef.current) return;
        busyRef.current = true; setBusy(true); setError('');
        try {
            await requestLink(t, { action: 'finish', token: attempt.token, telegramId: state.account.id });
            if (!activeRef.current) return;
            setOpen(false); setAttempt(null); successRef.current();
        } catch (e) { if (activeRef.current) setError(e instanceof Error ? e.message : t('cabinet.telegramLink.connectError', 'Не удалось подключить Telegram')); }
        finally { busyRef.current = false; if (activeRef.current) setBusy(false); }
    }

    const button = 'min-h-11 rounded-xl bg-[#229ED9] px-4 py-2 font-semibold text-white disabled:opacity-50';
    return <>
        <div className="max-w-sm space-y-1 text-right">
            <button type="button" className={button} disabled={busy} onClick={start}>{t('cabinet.telegramLink.start', 'Подключить через Telegram')}</button>
            <p className="text-xs text-[var(--text-secondary)]">{t('cabinet.telegramLink.startHint', 'Выберите нужный аккаунт в приложении Telegram')}</p>
        </div>
        {open && createPortal(<div className="fixed inset-0 z-[130]">
            <Dialog open onClose={cancel} dismissible={!busy} title={t('cabinet.telegramLink.title', 'Подключение Telegram')} size="md">
                <div className="max-h-[65dvh] space-y-4 overflow-y-auto" aria-busy={busy}>
                    {error && <p role="alert" className="rounded-xl border border-red-400/40 p-3 text-[var(--text-primary)]">{error}</p>}
                    {!attempt && <p>{busy ? t('cabinet.telegramLink.preparing', 'Готовим безопасную ссылку…') : t('cabinet.telegramLink.createPrompt', 'Создайте ссылку для подключения вашего Telegram.')}</p>}
                    {attempt && state.status === 'pending' && <>
                        <ol className="list-decimal space-y-2 pl-5 text-sm text-[var(--text-secondary)]">
                            <li>{t('cabinet.telegramLink.step1', 'В Telegram переключитесь на аккаунт, который хотите подключить.')}</li>
                            <li>{t('cabinet.telegramLink.step2', 'Откройте бота, нажмите «Начать», затем «Да, это мой запрос».')}</li>
                            <li>{t('cabinet.telegramLink.step3', 'Вернитесь сюда — покажем аккаунт перед подключением.')}</li>
                        </ol>
                        <a href={attempt.botDeepLink} target="_blank" rel="noopener noreferrer" className={`${button} flex items-center justify-center`}>{t('cabinet.telegramLink.openBot', 'Открыть бота в Telegram')}</a>
                        <details className="rounded-xl border border-[var(--border-subtle)] p-3">
                            <summary className="cursor-pointer text-sm">{t('cabinet.telegramLink.qr', 'Открыть на телефоне по QR-коду')}</summary>
                            <div className="mx-auto mt-3 w-fit rounded-xl bg-white p-3"><QRCodeSVG value={attempt.botDeepLink} size={168} /></div>
                        </details>
                        <p role="status" className="text-sm text-[var(--text-secondary)]">{pollFailed
                            ? t('cabinet.telegramLink.pollError', 'Связь прервалась. Проверяем подтверждение повторно…')
                            : t('cabinet.telegramLink.waiting', 'Ожидаем подтверждение в Telegram… Ссылка действует 5 минут.')}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{t('cabinet.telegramLink.doNotShare', 'Не пересылайте ссылку или QR-код другим людям.')}</p>
                    </>}
                    {state.status === 'approved' && state.account && <>
                        <p className="text-sm text-[var(--text-secondary)]">{t('cabinet.telegramLink.checkAccount', 'Проверьте: это ваш Telegram-аккаунт?')}</p>
                        <div className="rounded-xl border border-[var(--border-subtle)] p-4">
                            <p className="font-semibold">{state.account.name || t('cabinet.telegramLink.accountFallback', 'Telegram-аккаунт')}</p>
                            {state.account.username && <p>@{state.account.username}</p>}
                            <p className="text-xs text-[var(--text-secondary)]">ID: {state.account.id}</p>
                        </div>
                        <button type="button" className={`${button} w-full`} disabled={busy} onClick={finish}>{t('cabinet.telegramLink.finish', 'Подключить этот аккаунт')}</button>
                    </>}
                    {['expired', 'cancelled'].includes(state.status) && <p role="status">{state.status === 'expired'
                        ? t('cabinet.telegramLink.expired', 'Время действия ссылки закончилось. Создайте новую ссылку.')
                        : t('cabinet.telegramLink.cancelled', 'Подключение отменено в Telegram. Создайте новую ссылку.')}</p>}
                    {!busy && <button type="button" className="min-h-11 text-sm text-[var(--accent-primary)] underline" onClick={start}>
                        {attempt && ['pending', 'approved'].includes(state.status)
                            ? t('cabinet.telegramLink.newLinkOtherAccount', 'Выбрать другой аккаунт — новая ссылка')
                            : t('cabinet.telegramLink.newLink', 'Создать новую ссылку')}
                    </button>}
                    <p className="text-xs text-[var(--text-secondary)]">{t('cabinet.telegramLink.profileKept', 'Текущий профиль Kezek останется прежним. Другие профили не объединяются.')}</p>
                </div>
            </Dialog>
        </div>, document.body)}
    </>;
}
