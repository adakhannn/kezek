'use client';

import { addDays, addWeeks, startOfWeek } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import type { Branch } from './scheduleTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { supabase } from '@/lib/supabaseClient';
import { TZ } from '@/lib/time';

function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, index) => addDays(targetWeekStart, index));
}

export function TransfersTab({
    bizId,
    staffId,
    branches,
    homeBranchId,
}: {
    bizId: string;
    staffId: string;
    branches: Branch[];
    homeBranchId: string;
}) {
    const { t } = useLanguage();
    const [transfers, setTransfers] = useState<
        Array<{
            id: string;
            date_on: string;
            branch_id: string;
            branch_name: string;
        }>
    >([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            const weekStart = formatInTimeZone(getWeekDates(0)[0], TZ, 'yyyy-MM-dd');
            const weekEnd = formatInTimeZone(addDays(getWeekDates(1)[6], 1), TZ, 'yyyy-MM-dd');

            const { data } = await supabase
                .from('staff_schedule_rules')
                .select('id, date_on, branch_id')
                .eq('biz_id', bizId)
                .eq('staff_id', staffId)
                .eq('kind', 'date')
                .eq('is_active', true)
                .neq('branch_id', homeBranchId)
                .gte('date_on', weekStart)
                .lt('date_on', weekEnd)
                .order('date_on', { ascending: true });

            if (ignore) return;

            const transfersData = (data ?? [])
                .map((row) => {
                    const branch = branches.find((item) => item.id === row.branch_id);
                    return {
                        id: row.id,
                        date_on: row.date_on,
                        branch_id: row.branch_id,
                        branch_name: branch?.name || t('staff.schedule.transfers.unknownBranch', 'Неизвестный филиал'),
                    };
                })
                .filter((transfer) => transfer.branch_name !== t('staff.schedule.transfers.unknownBranch', 'Неизвестный филиал'));

            setTransfers(transfersData);
            setLoading(false);
        })();
        return () => {
            ignore = true;
        };
    }, [bizId, staffId, homeBranchId, branches, t]);

    const homeBranch = branches.find((branch) => branch.id === homeBranchId);
    const homeBranchName = homeBranch?.name || t('staff.schedule.transfers.homeBranchDefault', 'Основной филиал');

    if (loading) {
        return (
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {t('staff.schedule.transfers.loading', 'Загрузка переводов...')}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>{t('staff.schedule.transfers.title', 'Временные переводы')}</span>
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    {t('staff.schedule.transfers.subtitle', 'Список дней, когда сотрудник временно переведен на другой филиал')}
                </p>
            </div>

            {transfers.length === 0 ? (
                <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 mb-1">
                        {t('staff.schedule.transfers.empty.title', 'Нет временных переводов')}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                        {t('staff.schedule.transfers.empty.desc', 'Временные переводы настраиваются в разделе «Расписание» при выборе филиала для дня')}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="mb-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                        <p className="text-xs sm:text-sm text-indigo-800 dark:text-indigo-200">
                            <span className="font-medium">{t('staff.schedule.transfers.homeBranch', 'Основной филиал:')}</span> {homeBranchName}
                        </p>
                    </div>
                    <div className="space-y-2">
                        {transfers.map((transfer) => {
                            const transferDate = new Date(`${transfer.date_on}T12:00:00`);
                            const isToday =
                                formatInTimeZone(transferDate, TZ, 'yyyy-MM-dd') === formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');
                            const isPast =
                                formatInTimeZone(transferDate, TZ, 'yyyy-MM-dd') < formatInTimeZone(new Date(), TZ, 'yyyy-MM-dd');

                            return (
                                <div
                                    key={transfer.id}
                                    className={`flex items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg border transition-all ${
                                        isToday
                                            ? 'border-indigo-300 bg-indigo-50/50 dark:border-indigo-700 dark:bg-indigo-950/40 shadow-sm'
                                            : isPast
                                                ? 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 opacity-75'
                                                : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:shadow-sm dark:hover:border-indigo-700'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100">
                                                {formatInTimeZone(transferDate, TZ, 'dd.MM.yyyy')}
                                            </span>
                                            {isToday && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 whitespace-nowrap">
                                                    <span className="inline-flex h-1 w-1 sm:h-1.5 sm:w-1.5 rounded-full bg-indigo-500" />
                                                    {t('staff.schedule.today', 'Сегодня')}
                                                </span>
                                            )}
                                            {isPast && (
                                                <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                    {t('staff.schedule.transfers.past', 'Прошлое')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <span className="truncate">{transfer.branch_name}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span className="hidden sm:inline">{t('staff.schedule.transfers.transferred', 'Переведен')}</span>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40 px-4 py-3">
                <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                        <p className="font-medium">{t('staff.schedule.transfers.instructions.title', 'Как работают временные переводы')}</p>
                        <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700 dark:text-blue-300">
                            <li>{t('staff.schedule.transfers.instructions.setup', 'Временные переводы настраиваются в разделе «Расписание»')}</li>
                            <li>{t('staff.schedule.transfers.instructions.select', 'Выберите филиал для конкретного дня при редактировании расписания')}</li>
                            <li>{t('staff.schedule.transfers.instructions.oneDay', 'Перевод действует только на выбранный день')}</li>
                            <li>{t('staff.schedule.transfers.instructions.otherDays', 'В остальные дни сотрудник работает в основном филиале')}</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
