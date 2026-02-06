// apps/web/src/app/staff/finance/components/ShiftControls.tsx

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';

interface ShiftControlsProps {
    hasShift: boolean;
    isOpen: boolean;
    isClosed: boolean;
    isDayOff: boolean;
    loading: boolean;
    saving: boolean;
    onOpenShift: () => void;
    onCloseShift: () => void;
    onRefresh: () => void;
}

export function ShiftControls({
    hasShift,
    isOpen,
    isClosed,
    isDayOff,
    loading,
    saving,
    onOpenShift,
    onCloseShift,
    onRefresh,
}: ShiftControlsProps) {
    const { t } = useLanguage();

    return (
        <div className="flex gap-2 items-center flex-wrap">
            {!hasShift && (
                <>
                    {isDayOff ? (
                        <div className="text-sm text-amber-600 dark:text-amber-400 font-medium px-3 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
                            {t('staff.finance.shift.dayOff', 'Выходной день')}
                        </div>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={onOpenShift}
                            disabled={loading || saving || isDayOff}
                            isLoading={saving}
                        >
                            {t('staff.finance.shift.open', 'Открыть смену')}
                        </Button>
                    )}
                </>
            )}
            {isOpen && (
                <>
                    <Button
                        variant="outline"
                        onClick={onRefresh}
                        disabled={loading || saving}
                    >
                        {t('staff.finance.shift.refresh', 'Обновить')}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={onCloseShift}
                        disabled={saving}
                        isLoading={saving}
                    >
                        {t('staff.finance.shift.close', 'Закрыть смену')}
                    </Button>
                </>
            )}
            {isClosed && (
                <Button
                    variant="outline"
                    onClick={onOpenShift}
                    disabled={saving}
                    isLoading={saving}
                >
                    {t('staff.finance.shift.reopen', 'Переоткрыть')}
                </Button>
            )}
        </div>
    );
}

