'use client';


import { BookingEmptyState } from '../BookingEmptyState';
import type { Branch } from '../types';

import { RatingDisplay } from '@/components/RatingDisplay';

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
        <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('booking.step1.title', 'Шаг 1. Выберите филиал')}
            </h2>
            <button
                type="button"
                data-testid="branch-select"
                className="mb-3 inline-flex items-center rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            >
                {t('booking.testIds.branchSelect', 'Выбрать филиал')}
            </button>
            {branches.length === 0 ? (
                <BookingEmptyState
                    type="empty"
                    message={t('booking.empty.noBranches', 'У этого бизнеса нет активных филиалов. Пожалуйста, вернитесь позже.')}
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {branches.map((b) => {
                        const active = b.id === selectedBranchId;
                        return (
                            <button
                                key={b.id}
                                type="button"
                                data-testid="branch-card"
                                onClick={() => onSelect(b.id)}
                                className={`flex flex-col items-start rounded-lg border p-3 text-left transition ${
                                    active
                                        ? 'border-indigo-600 bg-indigo-50 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60'
                                        : 'border-gray-300 bg-white hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span
                                        data-testid="branch-option"
                                        className={`text-sm font-medium ${
                                        active
                                            ? 'text-indigo-700 dark:text-indigo-100'
                                            : 'text-gray-800 dark:text-gray-100'
                                    }`}
                                    >
                                        {formatBranchName(b.name)}
                                    </span>
                                    <RatingDisplay score={b.rating_score} t={t} variant="badge" className="ml-2 px-2 py-0.5 [&_svg]:w-3 [&_svg]:h-3" />
                                </div>
                                {b.address && (
                                    <span className={`mt-1 text-xs ${
                                        active
                                            ? 'text-indigo-600 dark:text-indigo-200'
                                            : 'text-gray-600 dark:text-gray-400'
                                    }`}>
                                        {b.address}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

