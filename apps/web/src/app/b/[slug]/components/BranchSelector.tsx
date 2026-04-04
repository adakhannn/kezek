'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Branch } from '../types';

import { RatingDisplay } from '@/components/RatingDisplay';
import { Badge } from '@/components/ui/Badge';
import { Card, cardStyles } from '@/components/ui/Card';

type BranchSelectorProps = {
    branches: Branch[];
    selectedBranchId: string;
    onSelect: (branchId: string) => void;
    formatBranchName: (name: string) => string;
    t: (key: string, fallback?: string) => string;
};

export function BranchSelector({
    branches,
    selectedBranchId,
    onSelect,
    formatBranchName,
    t,
}: BranchSelectorProps) {
    return (
        <Card variant="elevated" padding="lg">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="type-label text-[var(--accent-primary)]">
                        {t('booking.step1.kicker', 'Шаг 1')}
                    </p>
                    <h2 className="type-section-title mt-2 text-[var(--text-primary)]">
                        {t('booking.step1.title', 'Выберите филиал')}
                    </h2>
                    <p className="type-caption mt-2 text-[var(--text-secondary)]">
                        {t('booking.step1.description', 'Начните с локации, чтобы дальше система показала релевантных сотрудников и доступные услуги.')}
                    </p>
                </div>
                <Badge variant="info">{`${branches.length} ${t('booking.step1.branchesCount', 'локаций')}`}</Badge>
            </div>

            {branches.length === 0 ? (
                <BookingEmptyState
                    type="empty"
                    message={t('booking.empty.noBranches', 'У этого бизнеса пока нет активных филиалов. Пожалуйста, вернитесь позже.')}
                />
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {branches.map((branch) => {
                        const active = branch.id === selectedBranchId;

                        return (
                            <button
                                key={branch.id}
                                type="button"
                                data-testid="branch-card"
                                onClick={() => onSelect(branch.id)}
                                className={cardStyles({
                                    variant: active ? 'glass' : 'default',
                                    padding: 'md',
                                    className: [
                                        'flex flex-col items-start gap-4 text-left',
                                        active
                                            ? 'border-[var(--accent-primary)] bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)] shadow-[var(--shadow-md)]'
                                            : 'hover:border-[var(--accent-primary)] hover:bg-[color:color-mix(in_srgb,var(--surface-card)_94%,transparent)]',
                                    ].join(' '),
                                })}
                            >
                                <div className="flex w-full items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={[
                                                    'inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold',
                                                    active
                                                        ? 'bg-[var(--accent-primary)] text-[var(--text-inverse)]'
                                                        : 'bg-[var(--surface-emphasis)] text-[var(--text-secondary)]',
                                                ].join(' ')}
                                            >
                                                {active ? '✓' : '•'}
                                            </span>
                                            <span
                                                data-testid="branch-option"
                                                className="type-label text-[var(--text-primary)]"
                                            >
                                                {formatBranchName(branch.name)}
                                            </span>
                                        </div>
                                        {branch.address ? (
                                            <p className="type-caption text-[var(--text-secondary)]">{branch.address}</p>
                                        ) : null}
                                    </div>

                                    <RatingDisplay
                                        score={branch.rating_score}
                                        t={t}
                                        variant="badge"
                                        className="px-2 py-0.5 [&_svg]:h-3 [&_svg]:w-3"
                                    />
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant={active ? 'accent' : 'neutral'}>
                                        {active
                                            ? t('booking.step1.selectedBranch', 'Выбрано для записи')
                                            : t('booking.step1.availableBranch', 'Доступно для выбора')}
                                    </Badge>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
        </Card>
    );
}
