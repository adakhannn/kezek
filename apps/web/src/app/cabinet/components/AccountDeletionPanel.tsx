'use client';

import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

type Blocker = { code: string; message: string; count: number };
type State = {
    request: { status: string; requested_at: string; scheduled_for: string } | null;
    blockers: Blocker[];
    eligible: boolean;
};

export function AccountDeletionPanel() {
    const { locale, t } = useLanguage();
    const [state, setState] = useState<State | null>(null);
    const [confirmation, setConfirmation] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        const response = await fetch('/api/account/deletion', { cache: 'no-store' });
        const payload = (await response.json()) as { ok?: boolean; data?: State; message?: string };
        if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.message || 'Не удалось проверить возможность удаления');
        setState(payload.data);
    }

    useEffect(() => {
        load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Ошибка загрузки'));
    }, []);

    async function requestDeletion() {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/account/deletion', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ confirmation }),
            });
            const payload = (await response.json()) as { ok?: boolean; message?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось запросить удаление');
            setConfirmation('');
            await load();
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Ошибка запроса удаления');
        } finally {
            setBusy(false);
        }
    }

    async function cancelDeletion() {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch('/api/account/deletion', { method: 'DELETE' });
            const payload = (await response.json()) as { ok?: boolean; message?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.message || 'Не удалось отменить удаление');
            await load();
        } catch (cancelError) {
            setError(cancelError instanceof Error ? cancelError.message : 'Ошибка отмены удаления');
        } finally {
            setBusy(false);
        }
    }

    const pending = state?.request?.status === 'pending';
    const confirmationPhrase = t('cabinet.profile.deletion.confirmationPhrase', 'УДАЛИТЬ');
    const scheduledFor = state?.request
        ? new Intl.DateTimeFormat(locale === 'ky' ? 'ky-KG' : locale === 'en' ? 'en-US' : 'ru-RU', {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(state.request.scheduled_for))
        : null;
    const blockerMessage = (blocker: Blocker) => t(
        `cabinet.profile.deletion.blocker.${blocker.code}` as never,
        blocker.message,
    );

    return (
        <Card variant="outlined" padding="lg" className="space-y-4 border-red-300/60 dark:border-red-900/60">
            <div>
                <h3 className="type-section-title text-red-700 dark:text-red-300">{t('cabinet.profile.deletion.title', 'Удаление аккаунта')}</h3>
                <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                    {t('cabinet.profile.deletion.description', 'После запроса у вас будет 7 дней на отмену. Затем личные данные и способы входа будут удалены, а история завершённых записей — обезличена.')}
                </p>
            </div>

            {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            {pending ? (
                <AlertBanner
                    variant="warning"
                    title={t('cabinet.profile.deletion.pending.title', 'Аккаунт ожидает удаления')}
                    message={t('cabinet.profile.deletion.pending.message', `Удаление запланировано на ${scheduledFor}. До этого момента запрос можно отменить.`).replace('{date}', scheduledFor ?? '')}
                    action={<Button type="button" size="sm" variant="outline" onClick={cancelDeletion} isLoading={busy}>{t('cabinet.profile.deletion.cancel', 'Отменить удаление')}</Button>}
                />
            ) : (
                <>
                    {state?.blockers?.length ? (
                        <div className="rounded-[var(--radius-md)] bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            <p className="type-label">{t('cabinet.profile.deletion.blocked.title', 'Сейчас удалить аккаунт нельзя:')}</p>
                            <ul className="type-caption mt-2 list-disc space-y-1 pl-5">
                                {state.blockers.map((blocker) => <li key={blocker.code}>{blockerMessage(blocker)} ({blocker.count})</li>)}
                            </ul>
                        </div>
                    ) : null}

                    <Input
                        label={t('cabinet.profile.deletion.confirmation.label', 'Подтверждение')}
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        placeholder={t('cabinet.profile.deletion.confirmation.placeholder', `Введите ${confirmationPhrase}`).replace('{phrase}', confirmationPhrase)}
                        disabled={!state?.eligible || busy}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="danger"
                            onClick={requestDeletion}
                            disabled={!state?.eligible || confirmation !== confirmationPhrase}
                            isLoading={busy}
                        >
                            {t('cabinet.profile.deletion.request', 'Запросить удаление аккаунта')}
                        </Button>
                    </div>
                </>
            )}
        </Card>
    );
}
