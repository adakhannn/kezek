// apps/web/src/app/staff/finance/hooks/useShiftManagement.ts

import { useState } from 'react';

import type { ShiftItem } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';

interface UseShiftManagementReturn {
    saving: boolean;
    closingProgress: { show: boolean; message: string; progress?: number } | null;
    handleOpenShift: () => Promise<void>;
    handleCloseShift: (items: ShiftItem[], onSuccess?: () => void) => Promise<void>;
}

/**
 * Хук для управления сменой (открытие/закрытие)
 */
export function useShiftManagement(onShiftChanged?: () => void): UseShiftManagementReturn {
    const { t } = useLanguage();
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [closingProgress, setClosingProgress] = useState<{ show: boolean; message: string; progress?: number } | null>(null);

    const handleOpenShift = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/staff/shift/open', { method: 'POST' });
            const json = await res.json();
            if (!json.ok) {
                const errorMessage = json.error || json.message || t('staff.finance.error.openShift', 'Не удалось открыть смену');
                toast.showError(errorMessage);
            } else {
                toast.showSuccess(t('staff.finance.success.shiftOpened', 'Смена успешно открыта'));
                onShiftChanged?.();
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : t('staff.finance.error.openShift', 'Ошибка при открытии смены');
            toast.showError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleCloseShift = async (items: ShiftItem[], onSuccess?: () => void) => {
        setSaving(true);
        setClosingProgress({
            show: true,
            message: t('staff.finance.closing.processing', 'Обработка данных смены...'),
            progress: 0,
        });

        try {
            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.calculating', `Расчет сумм для ${items.length} клиентов...`),
                progress: 20,
            });

            const res = await fetch('/api/staff/shift/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
            });

            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.saving', 'Сохранение результатов...'),
                progress: 60,
            });

            const json = await res.json();
            
            if (!res.ok) {
                setClosingProgress(null);
                let errorMessage = t('staff.finance.error.closeShift', 'Не удалось закрыть смену');
                
                if (json.error) {
                    errorMessage = json.error;
                } else if (json.message) {
                    errorMessage = json.message;
                } else if (res.status === 400) {
                    errorMessage = t('staff.finance.error.closeShift.badRequest', 'Ошибка в данных. Проверьте суммы и попробуйте снова.');
                } else if (res.status === 403) {
                    errorMessage = t('staff.finance.error.closeShift.forbidden', 'У вас нет прав для закрытия смены.');
                } else if (res.status === 500) {
                    errorMessage = t('staff.finance.error.closeShift.serverError', 'Ошибка сервера. Попробуйте позже или обратитесь в поддержку.');
                } else if (res.status >= 400) {
                    errorMessage = t('staff.finance.error.closeShift.unknown', `Ошибка ${res.status}. Попробуйте позже.`);
                }
                
                toast.showError(errorMessage);
                return;
            }

            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.success', 'Смена успешно закрыта!'),
                progress: 100,
            });

            await new Promise((resolve) => setTimeout(resolve, 500));
            
            setClosingProgress(null);
            toast.showSuccess(t('staff.finance.success.shiftClosed', 'Смена успешно закрыта'));
            
            onSuccess?.();
            onShiftChanged?.();
        } catch (e) {
            setClosingProgress(null);
            let errorMessage = t('staff.finance.error.closeShift', 'Ошибка при закрытии смены');
            
            if (e instanceof TypeError && e.message.includes('fetch')) {
                errorMessage = t('staff.finance.error.closeShift.network', 'Ошибка сети. Проверьте подключение к интернету.');
            } else if (e instanceof Error) {
                errorMessage = e.message;
            }
            
            toast.showError(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    return {
        saving,
        closingProgress,
        handleOpenShift,
        handleCloseShift,
    };
}

