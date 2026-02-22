'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';

const STORAGE_KEY = 'staff_onboarding_dismissed_v1';

export function StaffOnboarding() {
    const { t } = useLanguage();
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        try {
            setVisible(!localStorage.getItem(STORAGE_KEY));
        } catch {
            setVisible(false);
        }
    }, []);

    const dismiss = () => {
        try {
            localStorage.setItem(STORAGE_KEY, '1');
            setVisible(false);
        } catch {
            setVisible(false);
        }
    };

    if (!visible) return null;

    const tips = [
        {
            href: '/staff/bookings',
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
            ),
            titleKey: 'staff.onboarding.bookings.title',
            hintKey: 'staff.onboarding.bookings.hint',
        },
        {
            href: '/staff/schedule',
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            ),
            titleKey: 'staff.onboarding.schedule.title',
            hintKey: 'staff.onboarding.schedule.hint',
        },
        {
            href: '/staff/finance',
            icon: (
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
                </svg>
            ),
            titleKey: 'staff.onboarding.finance.title',
            hintKey: 'staff.onboarding.finance.hint',
        },
    ] as const;

    return (
        <Card variant="elevated" className="p-4 sm:p-5 border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        {t('staff.onboarding.title', 'Кратко о разделах')}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        {t('staff.onboarding.subtitle', 'Здесь вы можете управлять записями, расписанием и учётом смен.')}
                    </p>
                    <ul className="space-y-3">
                        {tips.map((item) => (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className="flex gap-3 p-2.5 rounded-lg text-left transition-colors hover:bg-indigo-100/80 dark:hover:bg-indigo-900/30 group"
                                >
                                    <span className="text-indigo-600 dark:text-indigo-400 mt-0.5 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                                        {item.icon}
                                    </span>
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-gray-100 block text-sm">
                                            {t(item.titleKey, '')}
                                        </span>
                                        <span className="text-xs text-gray-600 dark:text-gray-400">
                                            {t(item.hintKey, '')}
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
                <button
                    type="button"
                    onClick={dismiss}
                    className="flex-shrink-0 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 transition-colors"
                >
                    {t('staff.onboarding.dismiss', 'Понятно')}
                </button>
            </div>
        </Card>
    );
}
