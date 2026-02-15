'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import {logDebug, logWarn} from '@/lib/log';

type Branch = { id: string; name: string };
type FoundUser = { id: string; email: string | null; phone: string | null; full_name: string };

export default function NewFromUser({ branches }: { branches: Branch[] }) {
    const { t } = useLanguage();
    const r = useRouter();

    const [q, setQ] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<FoundUser[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [branchId, setBranchId] = useState<string>(branches[0]?.id ?? '');
    const [isActive, setIsActive] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    async function doSearch(query: string) {
        setLoading(true);
        setErr(null);
        setHasSearched(true);
        try {
            const res = await fetch('/api/users/search', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ q: query }),
            });
            const j = await res.json();
            if (!j.ok) {
                setErr(j.error ?? 'search_failed');
                setResults([]);
            } else {
                setResults(j.items ?? []);
            }
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
        } finally {
            setLoading(false);
        }
    }

    async function createStaff() {
        if (!selectedUserId) return alert(t('staff.new.errors.selectUser', 'Выберите пользователя'));
        if (!branchId) return alert(t('staff.new.errors.selectBranch', 'Выберите филиал'));

        const res = await fetch('/api/staff/create-from-user', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ user_id: selectedUserId, branch_id: branchId, is_active: isActive }),
        });
        const j = await res.json();
        if (!j.ok) {
            return alert(j.error ?? t('staff.new.errors.createFailed', 'Не удалось создать сотрудника'));
        }
        
        // Логируем результат инициализации расписания
        if (j.schedule_initialized !== undefined) {
            logDebug('StaffCreation', 'Schedule initialization result', {
                success: j.schedule_initialized,
                daysCreated: j.schedule_days_created,
                error: j.schedule_error,
            });
            if (!j.schedule_initialized) {
                logWarn('StaffCreation', 'Schedule was NOT initialized', { error: j.schedule_error });
            }
        } else {
            logWarn('StaffCreation', 'No schedule initialization info in response');
        }
        
        r.push('/dashboard/staff');
    }

    return (
        <div className="space-y-6">
            {err && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {err}
                </div>
            )}

            <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('staff.new.search.label', 'Поиск пользователя')} <span className="text-gray-500 text-xs">({t('staff.new.search.hint', 'email / телефон / ФИО')})</span>
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t('staff.new.search.placeholder', 'Например: +996..., example@mail.com, Иван')}
                    />
                    <button
                        onClick={() => doSearch(q)}
                        className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? t('staff.new.search.searching', 'Ищем…') : t('staff.new.search.button', 'Найти')}
                    </button>
                </div>

                <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                    <table className="min-w-full text-sm">
                        <thead className="bg-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            <tr>
                                <th className="px-3 py-2 w-10">{t('staff.new.table.number', '#')}</th>
                                <th className="px-3 py-2">{t('staff.new.table.name', 'Имя')}</th>
                                <th className="px-3 py-2">{t('staff.new.table.email', 'Email')}</th>
                                <th className="px-3 py-2">{t('staff.new.table.phone', 'Телефон')}</th>
                                <th className="px-3 py-2 w-24 text-center">{t('staff.new.table.select', 'Выбрать')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((u, i) => (
                                <tr key={u.id} className="border-t border-gray-200 bg-white last:border-b dark:border-gray-800 dark:bg-gray-900">
                                    <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{i + 1}</td>
                                    <td className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100">{u.full_name}</td>
                                    <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200">{u.email ?? '—'}</td>
                                    <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-200">{u.phone ?? '—'}</td>
                                    <td className="px-3 py-2 text-center">
                                        <input
                                            type="radio"
                                            name="pick"
                                            checked={selectedUserId === u.id}
                                            onChange={() => setSelectedUserId(u.id)}
                                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600"
                                        />
                                    </td>
                                </tr>
                            ))}
                            {results.length === 0 && (
                                <tr>
                                    <td
                                        className="px-3 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                                        colSpan={5}
                                    >
                                        {hasSearched
                                            ? t('staff.new.table.empty.noResults', 'Ничего не найдено. Попробуйте изменить запрос.')
                                            : t('staff.new.table.empty.enterQuery', 'Введите запрос и нажмите «Найти», чтобы увидеть пользователей.')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:grid-cols-3 dark:border-gray-800 dark:bg-gray-900">
                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('staff.new.branch.label', 'Филиал')}</label>
                    <select
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        value={branchId}
                        onChange={(e) => setBranchId(e.target.value)}
                    >
                        {branches.map((b) => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                </div>
                <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:mt-7">
                    <input
                        id="is_active"
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600"
                    />
                    <span>{t('staff.new.active.label', 'Активен (доступен для записи)')}</span>
                </label>
                <div className="flex items-end">
                    <button
                        onClick={createStaff}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {t('staff.new.create.button', 'Добавить сотрудника')}
                    </button>
                </div>
            </div>
        </div>
    );
}
