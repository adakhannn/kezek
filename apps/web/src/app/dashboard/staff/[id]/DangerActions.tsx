'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';


export default function DangerActions({ staffId }: { staffId: string }) {
    const { t } = useLanguage();
    const r = useRouter();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function dismiss() {
        if (!confirm(t('staff.danger.dismiss.confirm', 'Уволить сотрудника? Будущие записи должны быть отменены заранее. Сотрудник будет скрыт, но данные сохранятся.'))) return;
        setBusy(true); setErr(null);
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/dismiss`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                setErr(json.error || json.message || `HTTP_${res.status}`);
                return;
            }
            // ✅ успешное увольнение — сразу на список сотрудников
            r.push('/dashboard/staff?dismissed=1');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    async function deletePermanently() {
        if (!confirm(t('staff.danger.delete.confirm', 'УДАЛИТЬ СОТРУДНИКА НАВСЕГДА?\n\nЭто действие нельзя отменить. Будут удалены:\n- Все прошедшие брони\n- Расписание\n- Связи с услугами\n- История назначений\n\nБудущие брони должны быть отменены заранее.'))) return;
        setBusy(true); setErr(null);
        try {
            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/delete`, { method: 'POST' });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || !json.ok) {
                setErr(json.error || json.message || `HTTP_${res.status}`);
                return;
            }
            // ✅ успешное удаление — сразу на список сотрудников
            r.push('/dashboard/staff?deleted=1');
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h3 className="text-lg font-bold text-red-800 dark:text-red-300">{t('staff.danger.title', 'Опасная зона')}</h3>
            </div>
            {err && (
                <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-700 dark:text-red-400">{err}</p>
                </div>
            )}
            <div className="space-y-3">
                <div>
                    <Button
                        variant="danger"
                        disabled={busy}
                        onClick={dismiss}
                        isLoading={busy}
                    >
                        {busy ? t('staff.danger.dismiss.processing', 'Выполняем…') : t('staff.danger.dismiss.button', 'Уволить сотрудника')}
                    </Button>
                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed mt-2">
                        {t('staff.danger.dismiss.desc', 'Сотрудник будет скрыт (is_active = false), но все данные сохранятся. Можно восстановить позже.')}
                    </p>
                </div>
                <div className="border-t border-red-200 dark:border-red-800 pt-3">
                    <Button
                        variant="danger"
                        disabled={busy}
                        onClick={deletePermanently}
                        isLoading={busy}
                    >
                        {busy ? t('staff.danger.delete.processing', 'Удаляем…') : t('staff.danger.delete.button', 'Удалить навсегда')}
                    </Button>
                    <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed mt-2">
                        {t('staff.danger.delete.desc', 'Полное удаление сотрудника и всех связанных данных. Будущие брони должны быть отменены. Это действие нельзя отменить.')}
                    </p>
                </div>
            </div>
        </div>
    );
}
