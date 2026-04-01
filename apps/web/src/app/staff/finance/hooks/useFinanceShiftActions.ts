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
            return t('staff.finance.shift.closing', 'Р—Р°РєСЂС‹С‚РёРµ СЃРјРµРЅС‹...');
        }
        if (mutations.isOpening) {
            return t('staff.finance.shift.opening', 'РћС‚РєСЂС‹С‚РёРµ СЃРјРµРЅС‹...');
        }
        if (mutations.isSaving) {
            return t('staff.finance.clients.saving', 'РЎРѕС…СЂР°РЅРµРЅРёРµ РєР»РёРµРЅС‚Р°...');
        }
        return t('staff.finance.loading', 'Р—Р°РіСЂСѓР·РєР° РґР°РЅРЅС‹С… СЃРјРµРЅС‹...');
    }, [mutations.isClosing, mutations.isOpening, mutations.isSaving, t]);

    return {
        handleOpenShift,
        handleCloseShift,
        loadingMessage,
        shouldShowLoading,
    };
}
