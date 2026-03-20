import { useMemo } from 'react';

type MutationFlags = {
    isOpening: boolean;
    isClosing: boolean;
    isSaving: boolean;
};

type UseFinanceLoadingStateOptions = {
    isLoading: boolean;
    mutations: MutationFlags;
    t: (key: string, fallback?: string) => string;
};

export function useFinanceLoadingState({
    isLoading,
    mutations,
    t,
}: UseFinanceLoadingStateOptions) {
    const shouldShowLoading = isLoading || mutations.isOpening || mutations.isClosing || mutations.isSaving;

    const loadingMessage = useMemo(() => {
        if (mutations.isClosing) {
            return t('staff.finance.shift.closing', 'Закрытие смены...');
        }
        if (mutations.isOpening) {
            return t('staff.finance.shift.opening', 'Открытие смены...');
        }
        if (mutations.isSaving) {
            return t('staff.finance.clients.saving', 'Сохранение клиента...');
        }
        return t('staff.finance.loading', 'Загрузка данных смены...');
    }, [mutations.isClosing, mutations.isOpening, mutations.isSaving, t]);

    return {
        shouldShowLoading,
        loadingMessage,
    };
}
