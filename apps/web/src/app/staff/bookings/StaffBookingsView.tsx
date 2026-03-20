'use client';

import { useState } from 'react';

import { CreateBookingForm } from './CreateBookingForm';
import { StaffBookingCard } from './StaffBookingCard';
import { StaffBookingsTabs } from './StaffBookingsTabs';
import type { Booking, Branch, Service, Staff } from './staffBookingsTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Card } from '@/components/ui/Card';

type Props = {
    bizId: string;
    staffId: string;
    branchId: string | null;
    upcoming: Booking[];
    past: Booking[];
    services: Service[];
    staff: Staff[];
    branches: Branch[];
};

export default function StaffBookingsView({
    bizId,
    staffId,
    branchId: defaultBranchId,
    upcoming,
    past,
    services,
    branches,
}: Props) {
    const { t, locale } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past' | 'create'>('upcoming');
    const bookings = tab === 'upcoming' ? upcoming : past;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <Card variant="elevated" className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {t('staff.cabinet.bookings.title', 'Мои записи')}
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400">
                                {t('staff.cabinet.bookings.subtitle', 'Управляйте своими записями')}
                            </p>
                        </div>

                        <StaffBookingsTabs
                            tab={tab}
                            setTab={setTab}
                            upcomingCount={upcoming.length}
                            pastCount={past.length}
                            t={t}
                        />
                    </div>
                </Card>

                {tab === 'create' ? (
                    <CreateBookingForm
                        bizId={bizId}
                        staffId={staffId}
                        defaultBranchId={defaultBranchId}
                        services={services}
                        branches={branches}
                    />
                ) : bookings.length === 0 ? (
                    <Card variant="elevated" className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            {tab === 'upcoming'
                                ? t('staff.cabinet.bookings.empty.upcoming', 'Нет предстоящих записей')
                                : t('staff.cabinet.bookings.empty.past', 'Нет прошедших записей')}
                        </p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {bookings.map((booking) => (
                            <StaffBookingCard key={booking.id} booking={booking} locale={locale} t={t} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
