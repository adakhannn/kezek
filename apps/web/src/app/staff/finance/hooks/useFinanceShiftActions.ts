import { useCallback, useMemo } from 'react';

import type { ShiftItem } from '../types';

type UseFinanceShiftActionsOptions = {
    localItems: ShiftItem[];
    mutations: {
        openShift: () => Promise<unknown>;
        closeShift: (items: ShiftItem[]) => Promise<unknown>;
        isOpening: boolean;
        isClosing: boolean;
        isSaving: boolean;
    };
    t: (key: string, fallback?: string) => string;
};

export function useFinanceShiftActions({
    localItems,
    mutations,
    t,
}: UseFinanceShiftActionsOptions) {
    const handleOpenShift = useCallback(async () => {
        try {
            await mutations.openShift();
        } catch {
            // Error is already handled in the mutation layer.
        }
    }, [mutations]);

    const handleCloseShift = useCallback(async () => {
        try {
            await mutations.closeShift(localItems);
        } catch {
            // Error is already handled in the mutation layer.
        }
    }, [localItems, mutations]);

    const shouldShowLoading =
        mutations.isOpening ||
        mutations.isClosing ||
        mutations.isSaving;

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
        handleOpenShift,
        handleCloseShift,
        loadingMessage,
        shouldShowLoading,
    };
}

