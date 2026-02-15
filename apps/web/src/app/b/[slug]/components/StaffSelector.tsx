/**
 * Компонент для выбора мастера
 * Вынесен из view.tsx для улучшения поддерживаемости
 */

'use client';

import { BookingEmptyState } from '../BookingEmptyState';
import type { Staff } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { transliterate } from '@/lib/transliterate';


type StaffSelectorProps = {
    staff: Staff[];
    selectedStaffId: string;
    onSelect: (staffId: string) => void;
    dayStr: string | null;
};

export function StaffSelector({ staff, selectedStaffId, onSelect, dayStr }: StaffSelectorProps) {
    const { t, locale } = useLanguage();

    const formatStaffName = (name: string): string => {
        if (locale === 'en') {
            return transliterate(name);
        }
        return name;
    };

    if (!dayStr) {
        return (
            <BookingEmptyState
                type="info"
                message={t('booking.empty.selectDayFirst', 'Сначала выберите день.')}
            />
        );
    }

    if (staff.length === 0) {
        return (
            <BookingEmptyState
                type="empty"
                message={t('booking.empty.noStaff', 'На выбранную дату в этом филиале нет доступных мастеров. Выберите другой день.')}
            />
        );
    }

    return (
        <>
            <button
                type="button"
                data-testid="master-select"
                className="mb-3 inline-flex items-center rounded-md border border-dashed border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-indigo-400 hover:text-indigo-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-indigo-400 dark:hover:text-indigo-200"
            >
                {t('booking.testIds.masterSelect', 'Выбрать мастера')}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Опция "Любой мастер" */}
                <button
                    type="button"
                    data-testid="master-card-any"
                    onClick={() => onSelect('any')}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition ${
                        selectedStaffId === 'any'
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                            : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                    }`}
                >
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 dark:from-indigo-600 dark:to-purple-700 flex items-center justify-center text-base font-semibold text-white flex-shrink-0">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                    </div>
                    <div className="flex-1 text-left">
                        <span data-testid="master-option-any">
                            {t('booking.step3.anyMaster', 'Любой мастер')}
                        </span>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {t('booking.step3.anyMasterHint', 'Ближайший свободный слот')}
                        </div>
                    </div>
                </button>

                {staff.map((m) => {
                    const active = m.id === selectedStaffId;
                    return (
                        <button
                            key={m.id}
                            type="button"
                            data-testid="master-card"
                            onClick={() => onSelect(m.id)}
                            className={`flex items-center gap-3 rounded-lg border p-3 text-sm font-medium transition ${
                                active
                                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-400 dark:bg-indigo-950/60 dark:text-indigo-100'
                                    : 'border-gray-300 bg-white text-gray-800 hover:border-indigo-500 hover:bg-indigo-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:hover:border-indigo-400 dark:hover:bg-indigo-950/40'
                            }`}
                        >
                            {m.avatar_url ? (
                                <img
                                    src={m.avatar_url}
                                    alt={formatStaffName(m.full_name)}
                                    className="h-12 w-12 rounded-full object-cover flex-shrink-0"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                            ) : (
                                <div className="h-12 w-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-base font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                                    {formatStaffName(m.full_name).charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="flex-1 flex items-center justify-between">
                                <span
                                    className="text-left"
                                    data-testid="master-option"
                                >
                                    {formatStaffName(m.full_name)}
                                </span>
                                {m.rating_score !== null && m.rating_score !== undefined && (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded border border-amber-200 dark:border-amber-800 ml-2">
                                        <svg className="w-3 h-3 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                            {m.rating_score.toFixed(1)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

