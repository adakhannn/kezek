'use client';

import { useEffect, useState } from 'react';

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

    return (
        <Card variant="outlined" padding="lg" className="space-y-4 border-red-300/60 dark:border-red-900/60">
            <div>
                <h3 className="type-section-title text-red-700 dark:text-red-300">Удаление аккаунта</h3>
                <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                    После запроса у вас будет 7 дней на отмену. Затем личные данные и способы входа будут удалены, а история завершённых записей — обезличена.
                </p>
            </div>

            {error ? <AlertBanner variant="danger" message={error} onClose={() => setError(null)} /> : null}

            {pending ? (
                <AlertBanner
                    variant="warning"
                    title="Аккаунт ожидает удаления"
                    message={`Удаление запланировано на ${new Date(state.request!.scheduled_for).toLocaleString('ru-RU')}. До этого момента запрос можно отменить.`}
                    action={<Button type="button" size="sm" variant="outline" onClick={cancelDeletion} isLoading={busy}>Отменить удаление</Button>}
                />
            ) : (
                <>
                    {state?.blockers?.length ? (
                        <div className="rounded-[var(--radius-md)] bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                            <p className="type-label">Сейчас удалить аккаунт нельзя:</p>
                            <ul className="type-caption mt-2 list-disc space-y-1 pl-5">
                                {state.blockers.map((blocker) => <li key={blocker.code}>{blocker.message} ({blocker.count})</li>)}
                            </ul>
                        </div>
                    ) : null}

                    <Input
                        label="Подтверждение"
                        value={confirmation}
                        onChange={(event) => setConfirmation(event.target.value)}
                        placeholder="Введите УДАЛИТЬ"
                        disabled={!state?.eligible || busy}
                    />
                    <div className="flex justify-end">
                        <Button
                            type="button"
                            variant="danger"
                            onClick={requestDeletion}
                            disabled={!state?.eligible || confirmation !== 'УДАЛИТЬ'}
                            isLoading={busy}
                        >
                            Запросить удаление аккаунта
                        </Button>
                    </div>
                </>
            )}
        </Card>
    );
}
