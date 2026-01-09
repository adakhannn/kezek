'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

type Branch = { id: string; name: string };

export default function TransferStaffDialog({
                                                staffId,
                                                currentBranchId,
                                                branches,
                                            }: {
    staffId: string;
    currentBranchId: string;
    branches: Branch[];
}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [target, setTarget] = useState<string>('');
    const [copySchedule, setCopySchedule] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const otherBranches = branches.filter(b => b.id !== currentBranchId);
    const currentBranch = branches.find(b => b.id === currentBranchId);

    async function submit() {
        setLoading(true); setErr(null);
        try {
            if (!target) { setErr(t('staff.transfer.errors.selectBranch', 'Выберите филиал')); setLoading(false); return; }

            const res = await fetch(`/api/staff/${encodeURIComponent(staffId)}/transfer`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ target_branch_id: target, copy_schedule: copySchedule }),
            });
            const j = await res.json().catch(() => ({ ok: false, error: 'NON_JSON_RESPONSE' }));
            if (!res.ok || !j.ok) {
                setErr(j.error ?? `HTTP_${res.status}`); setLoading(false); return;
            }
            setOpen(false);
            // Обновляем серверные компоненты страницы
            router.refresh(); // или: window.location.reload();
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : String(e));
            setLoading(false);
        }
    }

    return (
        <div>
            <button 
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors" 
                onClick={() => {
                    setOpen(true);
                    setTarget('');
                    setErr(null);
                }} 
                type="button"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                {t('staff.transfer.button', 'Перевести сотрудника')}
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !loading && setOpen(false)} />
                    <div className="relative bg-white dark:bg-gray-900 w-full max-w-lg rounded-xl sm:rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[90vh] overflow-y-auto">
                        {/* Заголовок */}
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                    </svg>
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                                        {t('staff.transfer.title', 'Постоянный перевод сотрудника')}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                        {t('staff.transfer.subtitle', 'Перевести сотрудника в другой филиал на постоянной основе')}
                                    </p>
                                </div>
                            </div>
                            {!loading && (
                                <button
                                    onClick={() => setOpen(false)}
                                    className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                                    type="button"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Текущий филиал */}
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {t('staff.transfer.current', 'Текущий филиал:')}
                                </span>
                            </div>
                            <p className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                                {currentBranch?.name ?? '—'}
                            </p>
                        </div>

                        {/* Выбор нового филиала */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                {t('staff.transfer.target.label', 'Новый филиал *')}
                            </label>
                            <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                disabled={loading}
                            >
                                <option value="">{t('staff.transfer.target.select', '— выберите филиал —')}</option>
                                {otherBranches.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Опции */}
                        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 sm:p-4 space-y-3">
                            <label className="inline-flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={copySchedule}
                                    onChange={(e) => setCopySchedule(e.target.checked)}
                                    disabled={loading}
                                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                    <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {t('staff.transfer.copySchedule', 'Скопировать шаблон расписания')}
                                    </span>
                                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('staff.transfer.copyScheduleDesc', 'Скопировать еженедельное расписание из текущего филиала в новый')}
                                    </span>
                                </div>
                            </label>
                        </div>

                        {/* Предупреждение */}
                        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 sm:p-4">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs sm:text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">
                                        {t('staff.transfer.warning.title', 'Важно:')}
                                    </p>
                                    <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
                                        <li>{t('staff.transfer.warning.permanent', 'Это постоянный перевод — сотрудник будет прикреплен к новому филиалу на постоянной основе')}</li>
                                        <li>{t('staff.transfer.warning.bookings', 'Будущие бронирования останутся без изменений (при необходимости их нужно будет перенести отдельно)')}</li>
                                        <li>{t('staff.transfer.warning.history', 'История переводов сохраняется в системе')}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* Ошибка */}
                        {err && (
                            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 sm:p-4">
                                <p className="text-sm text-red-600 dark:text-red-400">{err}</p>
                            </div>
                        )}

                        {/* Кнопки */}
                        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 sm:justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                                disabled={loading}
                                onClick={() => setOpen(false)}
                                type="button"
                            >
                                {t('staff.transfer.cancel', 'Отменить')}
                            </button>
                            <button
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                disabled={loading || !target}
                                onClick={submit}
                                type="button"
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span>{t('staff.transfer.processing', 'Перевожу…')}</span>
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{t('staff.transfer.submit', 'Подтвердить перевод')}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
