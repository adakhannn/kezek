'use client';

import { useState } from 'react';

import { BookingsViewTabs, CalendarDaySection } from './components/BookingsViewSections';
import { DashboardBookingsListSection } from './components/DashboardBookingsListSection';
import { QuickDesk } from './components/QuickDesk';
import type { BookingItem, BranchRow, ServiceRow, StaffRow, TabKey } from './components/bookingsViewTypes';
import { notify } from './notify';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getBusinessTimezone } from '@/lib/time';

export default function AdminBookingsView({
    bizId,
    businessTz,
    services,
    staff,
    branches,
    initial,
}: {
    bizId: string;
    businessTz?: string | null;
    services: ServiceRow[];
    staff: StaffRow[];
    branches: BranchRow[];
    initial: BookingItem[];
}) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<TabKey>('calendar');
    const timezone = getBusinessTimezone(businessTz);

    return (
        <div className="px-3 sm:px-4 lg:px-6 xl:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 sm:mb-2">
                            {t('bookings.title', 'Р‘СЂРѕРЅРё')}
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            {t('bookings.subtitle', 'РЈРїСЂР°РІР»РµРЅРёРµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏРјРё')}
                        </p>
                    </div>
                    <BookingsViewTabs value={tab} onChange={setTab} />
                </div>
            </div>

            {tab === 'calendar' && (
                <CalendarDaySection bizId={bizId} staff={staff} branches={branches} timezone={timezone} />
            )}
            {tab === 'list' && (
                <DashboardBookingsListSection
                    bizId={bizId}
                    initial={initial}
                    branches={branches}
                    timezone={timezone}
                    notify={notify}
                />
            )}
            {tab === 'desk' && (
                <QuickDesk
                    bizId={bizId}
                    services={services}
                    staff={staff}
                    branches={branches}
                    onTabChange={setTab}
                    timezone={timezone}
                />
            )}
        </div>
    );
}
