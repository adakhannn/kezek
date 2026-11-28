'use client';

import type { BookingStep } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';

type StepMeta = {
    id: BookingStep;
    label: string;
};

type BookingStepsProps = {
    stepsMeta: StepMeta[];
    step: BookingStep;
    totalSteps: number;
    canGoNext: boolean;
    goToStep: (step: BookingStep) => void;
    stepIndicatorText: string;
};

/**
 * Compact stepper: one line «Шаг N из 5 · <label>» and a row of step chips.
 * The step section below carries the title, so the current step is named once here.
 */
export function BookingSteps({
    stepsMeta,
    step,
    totalSteps,
    goToStep,
    stepIndicatorText,
}: BookingStepsProps) {
    const { t } = useLanguage();
    const progress = totalSteps > 0 ? Math.max(0, ((step - 1) / totalSteps) * 100) : 0;
    const currentLabel = stepsMeta.find((item) => item.id === step)?.label;

    return (
        <Card variant="elevated" padding="md" id="booking" className="overflow-hidden">
            <div className="flex flex-col gap-3">
                <p className="type-label text-[var(--text-primary)]" aria-live="polite" data-testid="booking-step-indicator">
                    <span className="text-[var(--accent-primary)]">{stepIndicatorText}</span>
                    {currentLabel ? <span className="text-[var(--text-secondary)]"> · {currentLabel}</span> : null}
                </p>

                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-emphasis)]">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        aria-label={stepIndicatorText}
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-[var(--motion-emphasis)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="list">
                    {stepsMeta.map((item, index) => {
                        const isActive = item.id === step;
                        const isCompleted = item.id < step;

                        return (
                            <div key={item.id} role="listitem" className="min-w-0">
                                <button
                                    type="button"
                                    disabled={!isCompleted}
                                    onClick={() => goToStep(item.id)}
                                    aria-current={isActive ? 'step' : undefined}
                                    aria-label={isCompleted ? t('booking.steps.backLabel', 'Вернуться к шагу {step}: {label}').replace('{step}', String(index + 1)).replace('{label}', item.label) : undefined}
                                    className={[
                                        'flex min-h-[44px] w-full min-w-0 flex-col items-center justify-center gap-1 rounded-[16px] border px-1 py-1.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-canvas)] sm:flex-row sm:gap-2 sm:px-3',
                                        isActive
                                            ? 'cursor-default border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)]'
                                            : isCompleted
                                                ? 'cursor-pointer border-[color:color-mix(in_srgb,var(--status-success)_26%,transparent)] bg-[var(--status-success-soft)] hover:border-[var(--status-success)]'
                                                : 'cursor-default border-[var(--border-subtle)] bg-[var(--surface-card)]',
                                    ].join(' ')}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={[
                                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                                            isActive
                                                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                                : isCompleted
                                                    ? 'border-[var(--status-success)] bg-[var(--status-success)] text-[var(--text-inverse)]'
                                                    : 'border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)]',
                                        ].join(' ')}
                                    >
                                        {isCompleted ? (
                                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            index + 1
                                        )}
                                    </span>
                                    <span
                                        className={[
                                            'block max-w-full truncate text-[11px] font-medium sm:text-xs',
                                            isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                                        ].join(' ')}
                                    >
                                        {item.label}
                                    </span>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
