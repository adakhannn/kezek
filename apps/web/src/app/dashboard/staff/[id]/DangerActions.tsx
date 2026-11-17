'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function DangerActions({ staffId, allowPermanentDelete = true }: { staffId: string; allowPermanentDelete?: boolean }) {
    const { t } = useLanguage();
    const r = useRouter();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [confirmMode, setConfirmMode] = useState<'dismiss' | 'delete' | null>(null);

    async function dismiss() {
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/dismiss`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                setErr(json.error || json.message || `HTTP_${res.status}`);
                return;
            }
            r.push('/dashboard/staff?dismissed=1');
            setConfirmMode(null);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function deletePermanently() {
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/delete`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                setErr(json.error || json.message || `HTTP_${res.status}`);
                return;
            }
            r.push('/dashboard/staff?deleted=1');
            setConfirmMode(null);
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4 rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-orange-50 p-6 shadow-lg dark:border-red-800 dark:from-red-900/20 dark:to-orange-900/20">
            <div className="flex items-center gap-3">
                <svg className="h-6 w-6 flex-shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300">{t('staff.danger.title', 'Опасная зона')}</h3>
            </div>

            {err ? <AlertBanner variant="danger" message={err} /> : null}

            <div className="space-y-3">
                <div>
                    <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => setConfirmMode('dismiss')}
                        isLoading={busy && confirmMode === 'dismiss'}
                    >
                        {busy && confirmMode === 'dismiss'
                            ? t('staff.danger.dismiss.processing', 'Выполняем…')
                            : t('staff.danger.dismiss.button', 'Уволить сотрудника')}
                    </Button>
                    <p className="mt-2 text-xs leading-relaxed text-red-700 dark:text-red-400">
                        {t('staff.danger.dismiss.desc', 'Сотрудник будет скрыт (is_active = false), но все данные сохранятся. Можно восстановить позже.')}
                    </p>
                </div>
                {allowPermanentDelete && <div className="border-t border-red-200 pt-3 dark:border-red-800">
                    <Button
                        variant="danger"
                        disabled={busy}
                        onClick={() => setConfirmMode('delete')}
                        isLoading={busy && confirmMode === 'delete'}
                    >
                        {busy && confirmMode === 'delete'
                            ? t('staff.danger.delete.processing', 'Удаляем…')
                            : t('staff.danger.delete.button', 'Удалить навсегда')}
                    </Button>
                    <p className="mt-2 text-xs leading-relaxed text-red-700 dark:text-red-400">
                        {t('staff.danger.delete.desc', 'Полное удаление сотрудника и всех связанных данных. Будущие брони должны быть отменены. Это действие нельзя отменить.')}
                    </p>
                </div>}
            </div>

            <ConfirmDialog
                open={confirmMode === 'dismiss'}
                onClose={() => setConfirmMode(null)}
                onConfirm={dismiss}
                title={t('staff.danger.dismiss.title', 'Уволить сотрудника?')}
                message={t('staff.danger.dismiss.confirm', 'Уволить сотрудника? Будущие записи должны быть отменены заранее. Сотрудник будет скрыт, но данные сохранятся.')}
                confirmLabel={t('staff.danger.dismiss.button', 'Уволить сотрудника')}
                cancelLabel={t('common.cancel', 'Отмена')}
                confirmVariant="danger"
                isLoading={busy && confirmMode === 'dismiss'}
            />
            {allowPermanentDelete && <ConfirmDialog
                open={confirmMode === 'delete'}
                onClose={() => setConfirmMode(null)}
                onConfirm={deletePermanently}
                title={t('staff.danger.delete.title', 'Удалить навсегда?')}
                message={t('staff.danger.delete.confirm', 'УДАЛИТЬ СОТРУДНИКА НАВСЕГДА?\n\nЭто действие нельзя отменить. Будут удалены:\n- Все прошедшие брони\n- Расписание\n- Связи с услугами\n- История назначений\n\nБудущие брони должны быть отменены заранее.')}
                confirmLabel={t('staff.danger.delete.button', 'Удалить навсегда')}
                cancelLabel={t('common.cancel', 'Отмена')}
                confirmVariant="danger"
                isLoading={busy && confirmMode === 'delete'}
            />}
        </div>
    );
}
