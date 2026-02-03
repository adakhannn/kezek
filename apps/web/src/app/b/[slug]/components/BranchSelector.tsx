'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Branch } from '../types';

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
                                    {b.rating_score !== null && b.rating_score !== undefined && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded border border-amber-200 dark:border-amber-800">
                                            <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                            </svg>
                                            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                {b.rating_score.toFixed(1)}
                                            </span>
                                        </div>
                                    )}
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

