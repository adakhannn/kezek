// apps/web/src/app/staff/finance/hooks/useShiftManagement.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useState } from 'react';

import type { ShiftItem } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { TZ } from '@/lib/time';

interface UseShiftManagementOptions {
    staffId?: string;
    shiftDate?: Date;
}

interface UseShiftManagementReturn {
    saving: boolean;
    closingProgress: { show: boolean; message: string; progress?: number } | null;
    handleOpenShift: () => Promise<void>;
    handleCloseShift: (items: ShiftItem[], onSuccess?: () => void) => Promise<void>;
}

/**
 * Хук для управления сменой (открытие/закрытие)
 */
export function useShiftManagement(
    onShiftChanged?: () => void,
    options?: UseShiftManagementOptions
): UseShiftManagementReturn {
    const { t } = useLanguage();
    const toast = useToast();
    const [saving, setSaving] = useState(false);
    const [closingProgress, setClosingProgress] = useState<{ show: boolean; message: string; progress?: number } | null>(null);

    const handleOpenShift = async () => {
        setSaving(true);
        try {
            // Если передан staffId, используем endpoint для владельца
            let url = '/api/staff/shift/open';
            if (options?.staffId && options?.shiftDate) {
                const dateStr = formatInTimeZone(options.shiftDate, TZ, 'yyyy-MM-dd');
                url = `/api/dashboard/staff/${options.staffId}/shift/open?date=${dateStr}`;
            }
            
            const res = await fetch(url, { method: 'POST' });
            
            // Проверяем HTTP статус перед парсингом JSON
            if (!res.ok) {
                let errorMessage = t('staff.finance.error.openShift', 'Не удалось открыть смену');
                
                // Пытаемся получить сообщение об ошибке из ответа
                try {
                    const errorJson = await res.json();
                    if (errorJson?.error) {
                        errorMessage = errorJson.error;
                    } else if (errorJson?.message) {
                        errorMessage = errorJson.message;
                    }
                } catch {
                    // Если не удалось распарсить JSON, используем стандартные сообщения по статусу
                }
                
                // Улучшенные сообщения для разных HTTP статусов
                if (res.status === 400) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.badRequest', 'Невозможно открыть смену. Проверьте, не открыта ли уже смена или не является ли сегодня выходным днем.');
                } else if (res.status === 401) {
                    errorMessage = t('staff.finance.error.openShift.unauthorized', 'Сессия истекла. Пожалуйста, войдите в систему снова.');
                } else if (res.status === 403) {
                    errorMessage = t('staff.finance.error.openShift.forbidden', 'У вас нет прав для открытия смены.');
                } else if (res.status === 429) {
                    errorMessage = t('staff.finance.error.openShift.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного.');
                } else if (res.status >= 500) {
                    errorMessage = t('staff.finance.error.openShift.server', 'Временная ошибка сервера. Попробуйте через несколько секунд.');
                } else if (res.status >= 400) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.client', 'Ошибка при открытии смены. Проверьте подключение к интернету.');
                }
                
                toast.showError(errorMessage);
                return;
            }
            
            const json = await res.json();
            if (!json.ok) {
                const errorMessage = json.error || json.message || t('staff.finance.error.openShift', 'Не удалось открыть смену');
                toast.showError(errorMessage);
            } else {
                toast.showSuccess(t('staff.finance.success.shiftOpened', 'Смена успешно открыта'));
                onShiftChanged?.();
            }
        } catch (e) {
            let errorMessage = t('staff.finance.error.openShift', 'Ошибка при открытии смены');
            
            // Улучшенная обработка различных типов ошибок
            if (e instanceof TypeError) {
                if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
                    errorMessage = t('staff.finance.error.openShift.network', 'Ошибка подключения к серверу. Проверьте подключение к интернету и попробуйте снова.');
                } else {
                    errorMessage = t('staff.finance.error.openShift.unknown', 'Произошла ошибка при открытии смены. Попробуйте обновить страницу.');
                }
            } else if (e instanceof Error) {
                if (e.message) {
                    errorMessage = e.message;
                }
            }
            
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
            
            // Улучшенная обработка различных типов ошибок
            if (e instanceof TypeError) {
                if (e.message.includes('fetch') || e.message.includes('network') || e.message.includes('Failed to fetch')) {
                    errorMessage = t('staff.finance.error.closeShift.network', 'Ошибка подключения к серверу. Проверьте подключение к интернету и попробуйте снова.');
                } else {
                    errorMessage = t('staff.finance.error.closeShift.unknown', 'Произошла ошибка при закрытии смены. Попробуйте обновить страницу.');
                }
            } else if (e instanceof Error) {
                if (e.message) {
                    errorMessage = e.message;
                } else {
                    errorMessage = t('staff.finance.error.closeShift.unknown', 'Произошла неожиданная ошибка. Попробуйте снова.');
                }
            } else {
                errorMessage = t('staff.finance.error.closeShift.unknown', 'Произошла неожиданная ошибка. Попробуйте обновить страницу.');
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

