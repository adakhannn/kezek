'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CreateBookingForm } from './CreateBookingForm';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/dateFormat';
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

type Service = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    active: boolean;
    branch_id: string;
};

type Staff = {
    id: string;
    full_name: string;
    is_active: boolean;
    branch_id: string;
};

type Branch = {
    id: string;
    name: string;
    is_active: boolean;
};

export default function StaffBookingsView({
    bizId,
    staffId,
    branchId: defaultBranchId,
    upcoming,
    past,
    services,
    staff,
    branches,
}: {
    bizId: string;
    staffId: string;
    branchId: string | null;
    upcoming: Booking[];
    past: Booking[];
    services: Service[];
    staff: Staff[];
    branches: Branch[];
}) {
    const { t, locale } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past' | 'create'>('upcoming');

    // Используем унифицированные функции форматирования дат
    const formatDateTimeLocal = (iso: string): string => formatDateTime(iso, locale as 'ru' | 'ky' | 'en', true);

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
                                <span className="ml-1">({upcoming.length})</span>
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
                                <span className="ml-1">({past.length})</span>
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
                                <Card key={booking.id} variant="elevated" className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                        <div className="flex-1 space-y-3 min-w-0">
                                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 truncate flex-1 min-w-0">
                                                    {serviceName}
                                                </h3>
                                                <div className="flex-shrink-0">{getStatusBadge(booking.status)}</div>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">
                                                        {t('staff.cabinet.bookings.card.time', 'Время')}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {formatDateTimeLocal(booking.start_at)} - {formatDateTimeLocal(booking.end_at)}
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

                                        <div className="flex gap-2 sm:flex-col">
                                            <Link href={`/booking/${booking.id}`} className="flex-1 sm:flex-none">
                                                <Button variant="outline" size="sm" className="w-full sm:w-auto">
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

