'use client';

import type { BookingStep } from '../types';

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

export function BookingSteps({
    stepsMeta,
    step,
    totalSteps,
    canGoNext,
    goToStep,
    stepIndicatorText,
}: BookingStepsProps) {
    const progress = totalSteps > 0 ? Math.max(0, ((step - 1) / totalSteps) * 100) : 0;

    return (
        <Card variant="elevated" padding="lg" id="booking" className="overflow-hidden">
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="type-label text-[var(--accent-primary)]" aria-live="polite">
                            {stepIndicatorText}
                        </p>
                        <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                            {stepsMeta.find((item) => item.id === step)?.label}
                        </h2>
                        <p className="type-caption mt-2 text-[var(--text-secondary)]">
                            {canGoNext
                                ? 'Текущий шаг заполнен достаточно, чтобы двигаться дальше.'
                                : 'Закончите текущий выбор, и поток автоматически станет понятнее на следующем шаге.'}
                        </p>
                    </div>

                    <div className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-emphasis)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)]">
                        {`Шаг ${step} из ${totalSteps}`}
                    </div>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-emphasis)]">
                    <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress)}
                        className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] transition-all duration-[var(--motion-emphasis)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <div className="grid gap-3 md:grid-cols-5" role="list">
                    {stepsMeta.map((item, index) => {
                        const isActive = item.id === step;
                        const isCompleted = item.id < step;
                        const isUpcoming = item.id > step;

                        return (
                            <div key={item.id} role="listitem" className="h-full">
                                <button
                                    type="button"
                                    disabled={!isCompleted}
                                    onClick={() => goToStep(item.id)}
                                    aria-current={isActive ? 'step' : undefined}
                                    aria-label={isCompleted ? `Вернуться к шагу ${index + 1}: ${item.label}` : undefined}
                                    className={[
                                        'h-full w-full rounded-[22px] border px-4 py-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-canvas)]',
                                        isActive
                                            ? 'cursor-default border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] shadow-[var(--shadow-sm)]'
                                            : isCompleted
                                                ? 'cursor-pointer border-[color:color-mix(in_srgb,var(--status-success)_26%,transparent)] bg-[var(--status-success-soft)] hover:-translate-y-0.5 hover:border-[var(--status-success)] hover:shadow-[var(--shadow-sm)]'
                                                : 'cursor-default border-[var(--border-subtle)] bg-[var(--surface-card)]',
                                    ].join(' ')}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div
                                            className={[
                                                'type-label flex h-9 w-9 items-center justify-center rounded-full border',
                                                isActive
                                                    ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                                    : isCompleted
                                                        ? 'border-[var(--status-success)] bg-[var(--status-success)] text-[var(--text-inverse)]'
                                                        : 'border-[var(--border-default)] bg-[var(--surface-base)] text-[var(--text-secondary)]',
                                            ].join(' ')}
                                        >
                                            {isCompleted ? (
                                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            ) : (
                                                index + 1
                                            )}
                                        </div>
                                        <span
                                            className={[
                                                'rounded-full px-2.5 py-1 text-[11px] font-medium',
                                                isActive
                                                    ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                                                    : isCompleted
                                                        ? 'bg-[var(--status-success-soft)] text-[var(--status-success)]'
                                                        : 'bg-[var(--surface-emphasis)] text-[var(--text-muted)]',
                                            ].join(' ')}
                                        >
                                            {isActive ? 'Сейчас' : isCompleted ? 'Готово' : isUpcoming ? 'Дальше' : ''}
                                        </span>
                                    </div>

                                    <div className="mt-3">
                                        <div className="type-label text-[var(--text-primary)]">{item.label}</div>
                                        <p className="type-caption mt-1 text-[var(--text-secondary)]">
                                            {isCompleted
                                                ? 'Нажмите, чтобы вернуться к этому шагу.'
                                                : isActive
                                                    ? 'Сделайте один понятный выбор и двигайтесь дальше.'
                                                    : 'Откроется после текущего выбора.'}
                                        </p>
                                    </div>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Card>
    );
}
