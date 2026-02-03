'use client';

import type { BookingStep } from '../types';

type StepMeta = {
    id: BookingStep;
    label: string;
};

type BookingStepsProps = {
    stepsMeta: StepMeta[];
    step: BookingStep;
    canGoNext: boolean;
    goPrev: () => void;
};

export function BookingSteps({ stepsMeta, step, canGoNext, goPrev }: BookingStepsProps) {
    return (
        <div id="booking" className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {stepsMeta.map((s, index) => {
                const isActive = s.id === step;
                const isCompleted = s.id < step;
                return (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                            // Переход к шагу возможен только если все предыдущие шаги валидны
                            if (s.id < step) {
                                goPrev();
                                return;
                            }
                            if (s.id > step && !canGoNext) return;
                            // Прямой переход на произвольный шаг пока ограничиваем UX-кнопками "Далее/Назад"
                        }}
                        className="flex items-center gap-2"
                    >
                        <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold transition ${
                                isActive
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                                    : isCompleted
                                    ? 'border-emerald-500 bg-emerald-500 text-white'
                                    : 'border-gray-300 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300'
                            }`}
                        >
                            {isCompleted ? '✓' : s.id}
                        </div>
                        <span
                            className={`text-[11px] font-medium ${
                                isActive
                                    ? 'text-indigo-700 dark:text-indigo-300'
                                    : 'text-gray-600 dark:text-gray-300'
                            }`}
                        >
                            {index + 1}. {s.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

