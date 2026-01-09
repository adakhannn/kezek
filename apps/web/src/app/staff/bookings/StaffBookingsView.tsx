'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';

type Booking = {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number } | null | { name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[];
    branches: { name: string; lat: number | null; lon: number | null; address: string | null } | null | { name: string; lat: number | null; lon: number | null; address: string | null }[];
    businesses: { name: string; slug: string | null } | null | { name: string; slug: string | null }[];
};

export default function StaffBookingsView({
    upcoming,
    past,
}: {
    upcoming: Booking[];
    past: Booking[];
}) {
    const { t, locale } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    function formatDateTime(iso: string): string {
        const dateFormat = locale === 'en' ? 'MM/dd/yyyy HH:mm' : 'dd.MM.yyyy HH:mm';
        return formatInTimeZone(new Date(iso), TZ, dateFormat);
    }

    function getServiceName(service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null): string {
        if (!service) return t('staff.cabinet.bookings.card.serviceDefault', 'Услуга');
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    function formatText(text: string | null | undefined, defaultText: string): string {
        if (!text) return defaultText;
        if (locale === 'en') return transliterate(text);
        return text;
    }

    function getStatusBadge(status: string) {
        const statusMap: Record<string, { labelKey: string; className: string }> = {
            hold: { labelKey: 'staff.cabinet.status.hold', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
            confirmed: { labelKey: 'staff.cabinet.status.confirmed', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            paid: { labelKey: 'staff.cabinet.status.paid', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            cancelled: { labelKey: 'staff.cabinet.status.cancelled', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
            no_show: { labelKey: 'staff.cabinet.status.noShow', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
        };
        const s = statusMap[status] || { labelKey: '', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
        const label = s.labelKey ? t(s.labelKey, status) : status;
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
                {label}
            </span>
        );
    }

    const bookings = tab === 'upcoming' ? upcoming : past;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Заголовок */}
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
                        <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'upcoming'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('upcoming')}
                            >
                                {t('staff.cabinet.bookings.tabs.upcoming', 'Предстоящие')} ({upcoming.length})
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'past'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('past')}
                            >
                                {t('staff.cabinet.bookings.tabs.past', 'Прошедшие')} ({past.length})
                            </button>
                        </div>
                    </div>
                </Card>

                {bookings.length === 0 ? (
                    <Card variant="elevated" className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            {tab === 'upcoming' 
                                ? t('staff.cabinet.bookings.empty.upcoming', 'Нет предстоящих записей')
                                : t('staff.cabinet.bookings.empty.past', 'Нет прошедших записей')
                            }
                        </p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {bookings.map((booking) => {
                            const clientName = booking.client_name || booking.client_phone || t('staff.cabinet.bookings.card.clientDefault', 'Клиент');
                            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                            const branch = Array.isArray(booking.branches) ? booking.branches[0] : booking.branches;
                            const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
                            const serviceName = getServiceName(service);
                            const branchName = branch?.name 
                                ? formatText(branch.name, t('staff.cabinet.bookings.card.branchDefault', 'Филиал'))
                                : t('staff.cabinet.bookings.card.branchDefault', 'Филиал');
                            const businessName = business?.name 
                                ? formatText(business.name, t('staff.cabinet.bookings.card.businessDefault', 'Бизнес'))
                                : t('staff.cabinet.bookings.card.businessDefault', 'Бизнес');

                            return (
                                <Card key={booking.id} variant="elevated" className="p-6 hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                                    {serviceName}
                                                </h3>
                                                {getStatusBadge(booking.status)}
                                            </div>

                                            <div className="grid sm:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.time', 'Время')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {formatDateTime(booking.start_at)} - {formatDateTime(booking.end_at)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.client', 'Клиент')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{clientName}</div>
                                                    {booking.client_phone && (
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">{booking.client_phone}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.branch', 'Филиал')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{branchName}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.business', 'Бизнес')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{businessName}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/booking/${booking.id}`}>
                                                <Button variant="outline" size="sm">
                                                    {t('staff.cabinet.bookings.card.details', 'Подробнее')}
                                                </Button>
                                            </Link>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}

