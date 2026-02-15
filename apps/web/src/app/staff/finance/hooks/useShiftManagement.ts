// apps/web/src/app/staff/finance/hooks/useShiftManagement.ts

import { formatInTimeZone } from 'date-fns-tz';
import { useState, useRef } from 'react';

import type { ShiftItem } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { useToast } from '@/hooks/useToast';
import { logError, logWarn } from '@/lib/log';
import { TZ } from '@/lib/time';

interface UseShiftManagementOptions {
    staffId?: string;
    shiftDate?: Date;
}

interface UseShiftManagementReturn {
    saving: boolean;
    closingProgress: { show: boolean; message: string; progress?: number; canCancel?: boolean } | null;
    handleOpenShift: () => Promise<void>;
    handleCloseShift: (items: ShiftItem[], onSuccess?: () => void) => Promise<void>;
    cancelCloseShift: () => void;
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
    const [closingProgress, setClosingProgress] = useState<{ show: boolean; message: string; progress?: number; canCancel?: boolean } | null>(null);
    // AbortController для отмены запроса закрытия смены
    const closeAbortControllerRef = useRef<AbortController | null>(null);

    const handleOpenShift = async () => {
        setSaving(true);
        let errorOccurred = false;
        try {
            // Если передан staffId, используем endpoint для владельца
            let url = '/api/staff/shift/open';
            if (options?.staffId && options?.shiftDate) {
                const dateStr = formatInTimeZone(options.shiftDate, TZ, 'yyyy-MM-dd');
                url = `/api/dashboard/staff/${options.staffId}/shift/open?date=${dateStr}`;
            }
            
            let res: Response;
            try {
                res = await fetch(url, { method: 'POST' });
            } catch (fetchError) {
                // Ошибка сети или другая ошибка fetch
                errorOccurred = true;
                let errorMessage = t('staff.finance.error.openShift', 'Ошибка при открытии смены');
                
                if (fetchError instanceof TypeError) {
                    if (fetchError.message.includes('fetch') || fetchError.message.includes('network') || fetchError.message.includes('Failed to fetch')) {
                        errorMessage = t('staff.finance.error.openShift.network', 'Ошибка подключения к серверу. Проверьте подключение к интернету и попробуйте снова.');
                    } else {
                        errorMessage = t('staff.finance.error.openShift.unknown', 'Произошла ошибка при открытии смены. Попробуйте обновить страницу.');
                    }
                } else if (fetchError instanceof Error) {
                    if (fetchError.name === 'RateLimitError') {
                        errorMessage = fetchError.message || t('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                        toast.showWarning(errorMessage);
                        return;
                    } else if (fetchError.message) {
                        errorMessage = fetchError.message;
                    }
                }
                
                toast.showError(errorMessage);
                logError('UseShiftManagement', 'Error opening shift (fetch)', fetchError);
                return;
            }
            
            // Проверяем HTTP статус перед парсингом JSON
            if (!res.ok) {
                errorOccurred = true;
                let errorMessage = t('staff.finance.error.openShift', 'Не удалось открыть смену');
                
                // Пытаемся получить сообщение об ошибке из ответа
                try {
                    const errorText = await res.text();
                    if (errorText) {
                        try {
                            const errorJson = JSON.parse(errorText);
                            if (errorJson?.error) {
                                errorMessage = errorJson.error;
                            } else if (errorJson?.message) {
                                errorMessage = errorJson.message;
                            }
                        } catch {
                            // Если не JSON, используем текст как есть (если он не пустой)
                            if (errorText.trim().length > 0 && errorText.trim().length < 200) {
                                errorMessage = errorText.trim();
                            }
                        }
                    }
                } catch (parseError) {
                    // Если не удалось распарсить ответ, используем стандартные сообщения по статусу
                    logWarn('UseShiftManagement', 'Failed to parse error response', parseError);
                }
                
                // Улучшенные сообщения для разных HTTP статусов
                if (res.status === 400) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.badRequest', 'Невозможно открыть смену. Проверьте, не открыта ли уже смена или не является ли сегодня выходным днем.');
                } else if (res.status === 401) {
                    errorMessage = t('staff.finance.error.openShift.unauthorized', 'Сессия истекла. Пожалуйста, войдите в систему снова.');
                } else if (res.status === 403) {
                    errorMessage = t('staff.finance.error.openShift.forbidden', 'У вас нет прав для открытия смены.');
                } else if (res.status === 404) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.notFound', 'Сотрудник или ресурс не найден.');
                } else if (res.status === 429) {
                    errorMessage = t('staff.finance.error.openShift.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного.');
                } else if (res.status >= 500) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.server', 'Временная ошибка сервера. Попробуйте через несколько секунд.');
                } else if (res.status >= 400) {
                    errorMessage = errorMessage || t('staff.finance.error.openShift.client', 'Ошибка при открытии смены. Проверьте подключение к интернету.');
                }
                
                toast.showError(errorMessage);
                logError('UseShiftManagement', 'Error opening shift (HTTP)', {
                    status: res.status,
                    statusText: res.statusText,
                    url,
                    errorMessage,
                });
                return;
            }
            
            // Парсим успешный ответ
            let json: { ok?: boolean; error?: string; message?: string; shift?: unknown };
            try {
                const jsonText = await res.text();
                if (!jsonText) {
                    errorOccurred = true;
                    const errorMessage = t('staff.finance.error.openShift.emptyResponse', 'Сервер вернул пустой ответ. Попробуйте снова.');
                    toast.showError(errorMessage);
                    logError('UseShiftManagement', 'Empty response from server');
                    return;
                }
                json = JSON.parse(jsonText);
            } catch (parseError) {
                errorOccurred = true;
                const errorMessage = t('staff.finance.error.openShift.invalidResponse', 'Сервер вернул некорректный ответ. Попробуйте снова.');
                toast.showError(errorMessage);
                logError('UseShiftManagement', 'Failed to parse response JSON', parseError);
                return;
            }
            
            // Проверяем результат в JSON
            if (!json.ok) {
                errorOccurred = true;
                const errorMessage = json.error || json.message || t('staff.finance.error.openShift', 'Не удалось открыть смену');
                toast.showError(errorMessage);
                logError('UseShiftManagement', 'Error in response JSON', json);
                return;
            }
            
            // Успешное открытие смены
            toast.showSuccess(t('staff.finance.success.shiftOpened', 'Смена успешно открыта'));
            onShiftChanged?.();
        } catch (e) {
            errorOccurred = true;
            let errorMessage = t('staff.finance.error.openShift', 'Ошибка при открытии смены');
            
            // Улучшенная обработка различных типов ошибок
            if (e instanceof Error && e.name === 'RateLimitError') {
                // Ошибка rate limiting
                errorMessage = e.message || t('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                toast.showWarning(errorMessage);
                return;
            } else if (e instanceof TypeError) {
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
            logError('UseShiftManagement', 'Unexpected error opening shift', e);
        } finally {
            setSaving(false);
        }
    };

    const handleCloseShift = async (items: ShiftItem[], onSuccess?: () => void) => {
        // Отменяем предыдущий запрос, если он еще выполняется
        if (closeAbortControllerRef.current) {
            closeAbortControllerRef.current.abort();
        }

        // Создаем новый AbortController для этого запроса
        const abortController = new AbortController();
        closeAbortControllerRef.current = abortController;

        setSaving(true);
        setClosingProgress({
            show: true,
            message: t('staff.finance.closing.processing', 'Обработка данных смены...'),
            progress: 0,
            canCancel: true,
        });

        try {
            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
                return;
            }

            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.calculating', `Расчет сумм для ${items.length} клиентов...`),
                progress: 20,
                canCancel: true,
            });

            const res = await fetch('/api/staff/shift/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items }),
                signal: abortController.signal,
            });

            // Проверяем, не был ли запрос отменен
            if (abortController.signal.aborted) {
                return;
            }

            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.saving', 'Сохранение результатов...'),
                progress: 60,
                canCancel: true,
            });

            const json = await res.json();
            
            // Проверяем, не был ли запрос отменен после парсинга
            if (abortController.signal.aborted) {
                return;
            }
            
            if (!res.ok) {
                setClosingProgress(null);
                closeAbortControllerRef.current = null;
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

            // Проверяем, не был ли запрос отменен перед финальным сообщением
            if (abortController.signal.aborted) {
                return;
            }

            setClosingProgress({
                show: true,
                message: t('staff.finance.closing.success', 'Смена успешно закрыта!'),
                progress: 100,
                canCancel: false,
            });

            await new Promise((resolve) => setTimeout(resolve, 500));
            
            // Проверяем, не был ли запрос отменен во время задержки
            if (abortController.signal.aborted) {
                return;
            }
            
            setClosingProgress(null);
            closeAbortControllerRef.current = null;
            toast.showSuccess(t('staff.finance.success.shiftClosed', 'Смена успешно закрыта'));
            
            onSuccess?.();
            onShiftChanged?.();
        } catch (e) {
            // Игнорируем ошибки отмены запроса
            if (e instanceof Error && e.name === 'AbortError') {
                setClosingProgress(null);
                closeAbortControllerRef.current = null;
                setSaving(false);
                toast.showInfo(t('staff.finance.closing.cancelled', 'Закрытие смены отменено'));
                return;
            }

            setClosingProgress(null);
            closeAbortControllerRef.current = null;
            let errorMessage = t('staff.finance.error.closeShift', 'Ошибка при закрытии смены');
            
            // Улучшенная обработка различных типов ошибок
            if (e instanceof Error && e.name === 'RateLimitError') {
                // Ошибка rate limiting
                errorMessage = e.message || t('staff.finance.error.rateLimit', 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.');
                toast.showWarning(errorMessage);
                return;
            } else if (e instanceof TypeError) {
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
            // Очищаем AbortController только если это был актуальный запрос
            if (closeAbortControllerRef.current === abortController) {
                closeAbortControllerRef.current = null;
            }
            setSaving(false);
        }
    };

    const cancelCloseShift = () => {
        if (closeAbortControllerRef.current) {
            closeAbortControllerRef.current.abort();
            closeAbortControllerRef.current = null;
        }
        setClosingProgress(null);
        setSaving(false);
    };

    return {
        saving,
        closingProgress,
        handleOpenShift,
        handleCloseShift,
        cancelCloseShift,
    };
}

