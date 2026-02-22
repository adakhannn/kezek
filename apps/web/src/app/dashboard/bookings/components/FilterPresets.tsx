/**
 * Пресеты фильтров для операторов
 * 
 * Быстрые фильтры: "Сегодня", "Мой мастер", "Только hold/confirmed"
 */

'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { formatInTimeZone } from 'date-fns-tz';

export type FilterPreset = 'today' | 'myStaff' | 'holdConfirmed' | null;

interface FilterPresetsProps {
    activePreset: FilterPreset;
    onPresetChange: (preset: FilterPreset) => void;
    timezone: string;
    currentStaffId?: string | null;
    hasStaffAccess?: boolean;
}

export function FilterPresets({
    activePreset,
    onPresetChange,
    timezone,
    currentStaffId,
    hasStaffAccess = false,
}: FilterPresetsProps) {
    const { t } = useLanguage();

    const presets: Array<{
        key: FilterPreset;
        label: string;
        icon: React.ReactNode;
    }> = [
        {
            key: 'today',
            label: t('bookings.presets.today', 'Сегодня'),
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
        },
        ...(hasStaffAccess && currentStaffId
            ? [
                  {
                      key: 'myStaff' as FilterPreset,
                      label: t('bookings.presets.myStaff', 'Мой мастер'),
                      icon: (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                      ),
                  },
              ]
            : []),
        {
            key: 'holdConfirmed',
            label: t('bookings.presets.holdConfirmed', 'Только hold/confirmed'),
            icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
                <button
                    key={preset.key}
                    type="button"
                    onClick={() => onPresetChange(activePreset === preset.key ? null : preset.key)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                        activePreset === preset.key
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-700'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                >
                    {preset.icon}
                    <span>{preset.label}</span>
                </button>
            ))}
        </div>
    );
}

/**
 * Применяет пресет фильтров к параметрам запроса
 */
export function applyPreset(
    preset: FilterPreset,
    timezone: string,
    currentStaffId?: string | null
): {
    statusFilter?: string;
    branchFilter?: string;
    dateFilter?: { gte: string; lte: string };
    staffFilter?: string;
} {
    const today = formatInTimeZone(new Date(), timezone, 'yyyy-MM-dd');
    const todayStart = `${today}T00:00:00`;
    const todayEnd = `${today}T23:59:59`;

    switch (preset) {
        case 'today':
            return {
                dateFilter: {
                    gte: todayStart,
                    lte: todayEnd,
                },
            };
        case 'myStaff':
            if (currentStaffId) {
                return {
                    staffFilter: currentStaffId,
                };
            }
            return {};
        case 'holdConfirmed':
            return {
                statusFilter: 'holdConfirmed', // Специальное значение для обработки в запросе
            };
        default:
            return {};
    }
}

