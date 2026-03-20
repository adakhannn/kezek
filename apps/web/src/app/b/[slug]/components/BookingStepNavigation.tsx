'use client';

import type { BookingStep } from '../types';

type BookingStepNavigationProps = {
    canGoPrev: boolean;
    canGoNext: boolean;
    goPrev: () => void;
    goNext: () => void;
    step: BookingStep;
    totalSteps: number;
    t: (key: string, fallback?: string) => string;
};

export function BookingStepNavigation({
    canGoPrev,
    canGoNext,
    goPrev,
    goNext,
    step,
    totalSteps,
    t,
}: BookingStepNavigationProps) {
    return (
        <div className="flex justify-between pt-1 text-xs">
            <button
                type="button"
                disabled={!canGoPrev}
                onClick={goPrev}
                className={`inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition min-h-[44px] sm:min-h-[32px] touch-manipulation ${
                    canGoPrev
                        ? 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800'
                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
                {t('booking.nav.back', '← Назад')}
            </button>
            <button
                type="button"
                disabled={!canGoNext}
                onClick={goNext}
                className={`inline-flex items-center gap-1 rounded-lg border px-4 py-2.5 sm:px-3 sm:py-1.5 text-sm sm:text-xs font-medium transition min-h-[44px] sm:min-h-[32px] touch-manipulation ${
                    canGoNext
                        ? 'border-indigo-500 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400'
                        : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-600 cursor-not-allowed'
                }`}
            >
                {step === totalSteps
                    ? t('booking.nav.selectTime', 'Выбрать время')
                    : t('booking.nav.next', 'Далее →')}
            </button>
        </div>
    );
}
