'use client';

type Tab = 'upcoming' | 'past' | 'create';
type TranslationFn = (key: string, fallback: string) => string;

type Props = {
    tab: Tab;
    setTab: (tab: Tab) => void;
    upcomingCount: number;
    pastCount: number;
    t: TranslationFn;
};

export function StaffBookingsTabs({ tab, setTab, upcomingCount, pastCount, t }: Props) {
    return (
        <div className="flex flex-col sm:flex-row gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                    tab === 'upcoming'
                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setTab('upcoming')}
            >
                <span className="sm:hidden">{t('staff.cabinet.bookings.tabs.upcomingShort', 'Предстоящие')}</span>
                <span className="hidden sm:inline">{t('staff.cabinet.bookings.tabs.upcoming', 'Предстоящие')}</span>
                <span className="ml-1">({upcomingCount})</span>
            </button>
            <button
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                    tab === 'past'
                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setTab('past')}
            >
                <span className="sm:hidden">{t('staff.cabinet.bookings.tabs.pastShort', 'Прошедшие')}</span>
                <span className="hidden sm:inline">{t('staff.cabinet.bookings.tabs.past', 'Прошедшие')}</span>
                <span className="ml-1">({pastCount})</span>
            </button>
            <button
                className={`px-3 sm:px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm sm:text-base ${
                    tab === 'create'
                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
                onClick={() => setTab('create')}
            >
                <span className="sm:hidden">{t('staff.cabinet.bookings.tabs.createShort', 'Создать')}</span>
                <span className="hidden sm:inline">{t('staff.cabinet.bookings.tabs.create', 'Создать запись')}</span>
            </button>
        </div>
    );
}
