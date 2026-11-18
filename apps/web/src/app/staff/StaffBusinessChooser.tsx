'use client';

import { useState } from 'react';

import { announceStaffSelection } from './staffSelectionContext';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { logWarn } from '@/lib/log';
import type { StaffOptionLabel } from '@/lib/staffSelection';

function useChooseStaffCard() {
    const { t } = useLanguage();
    const [pending, setPending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const choose = async (staffId: string) => {
        if (pending) return;
        setPending(staffId);
        setError(null);
        try {
            const response = await fetch('/api/me/current-staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staffId }),
            });
            const result = (await response.json().catch(() => null)) as { ok?: boolean } | null;
            if (!response.ok || !result?.ok) throw new Error(`HTTP ${response.status}`);
            announceStaffSelection(staffId);
            window.location.reload();
        } catch (cause) {
            logWarn('StaffBusinessChooser', 'Failed to choose staff card', cause);
            setPending(null);
            setError(t('staff.businessSelect.error', 'Не удалось выбрать бизнес. Попробуйте ещё раз.'));
        }
    };

    return { choose, pending, error };
}

function optionTitle(option: StaffOptionLabel, unnamed: string) {
    return option.businessName?.trim() || unnamed;
}

/** Full-page choice for a master of several businesses who has not chosen one yet (ARCH-02). */
export function StaffBusinessChooser({ options }: { options: StaffOptionLabel[] }) {
    const { t } = useLanguage();
    const { choose, pending, error } = useChooseStaffCard();
    const unnamed = t('staff.businessSelect.unnamed', 'Бизнес без названия');

    return (
        <main className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-10">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {t('staff.businessSelect.title', 'Выберите бизнес')}
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t('staff.businessSelect.subtitle', 'Вы работаете в нескольких бизнесах. Выберите, где продолжить.')}
            </p>
            <ul className="mt-6 space-y-3">
                {options.map((option) => (
                    <li key={option.staffId}>
                        <button
                            type="button"
                            onClick={() => void choose(option.staffId)}
                            disabled={pending !== null}
                            className="flex w-full items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition hover:border-indigo-400 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900"
                        >
                            <span className="min-w-0">
                                <span className="block truncate font-medium text-gray-900 dark:text-gray-100">
                                    {optionTitle(option, unnamed)}
                                </span>
                                {option.branchName ? (
                                    <span className="block truncate text-sm text-gray-500 dark:text-gray-400">{option.branchName}</span>
                                ) : null}
                            </span>
                            <span className="shrink-0 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                {pending === option.staffId
                                    ? t('staff.businessSelect.opening', 'Открываем…')
                                    : t('staff.businessSelect.open', 'Открыть')}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
            {error ? (
                <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            ) : null}
        </main>
    );
}

/** Compact switch between the master's businesses in the cabinet menu (more than one card). */
export function StaffBusinessSwitcher({ options, currentStaffId }: { options: StaffOptionLabel[]; currentStaffId: string }) {
    const { t } = useLanguage();
    const { choose, pending, error } = useChooseStaffCard();
    const unnamed = t('staff.businessSelect.unnamed', 'Бизнес без названия');

    return (
        <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400" htmlFor="staff-business-switcher">
                {t('staff.businessSelect.switch', 'Сменить бизнес')}
            </label>
            <select
                id="staff-business-switcher"
                value={pending ?? currentStaffId}
                disabled={pending !== null}
                onChange={(event) => {
                    if (event.target.value !== currentStaffId) void choose(event.target.value);
                }}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
                {options.map((option) => (
                    <option key={option.staffId} value={option.staffId}>
                        {optionTitle(option, unnamed)}
                        {option.branchName ? ` — ${option.branchName}` : ''}
                    </option>
                ))}
            </select>
            {error ? (
                <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
