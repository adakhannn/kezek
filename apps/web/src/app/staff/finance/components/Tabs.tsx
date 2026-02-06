// apps/web/src/app/staff/finance/components/Tabs.tsx

import type { TabKey } from '../types';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

interface TabsProps {
    activeTab: TabKey;
    onTabChange: (tab: TabKey) => void;
    itemsCount: number;
    showStats: boolean;
}

export function Tabs({ activeTab, onTabChange, itemsCount, showStats }: TabsProps) {
    const { t } = useLanguage();

    return (
        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
                onClick={() => onTabChange('shift')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'shift'
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
                {t('staff.finance.tabs.shift', 'Текущая смена')}
            </button>
            <button
                onClick={() => onTabChange('clients')}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    activeTab === 'clients'
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
            >
                {t('staff.finance.tabs.clients', 'Клиенты')} {itemsCount > 0 && `(${itemsCount})`}
            </button>
            {showStats && (
                <button
                    onClick={() => onTabChange('stats')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        activeTab === 'stats'
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-800'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                    {t('staff.finance.tabs.stats', 'Статистика')}
                </button>
            )}
        </div>
    );
}

