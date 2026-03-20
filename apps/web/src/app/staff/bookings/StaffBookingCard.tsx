'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/dateFormat';
import { transliterate } from '@/lib/transliterate';
import type { Booking } from './staffBookingsTypes';

type TranslationFn = (key: string, fallback: string) => string;

type Props = {
    booking: Booking;
    locale: string;
    t: TranslationFn;
};

export function StaffBookingCard({ booking, locale, t }: Props) {
    const formatDateTimeLocal = (iso: string): string => formatDateTime(iso, locale as 'ru' | 'ky' | 'en', true);

    function getServiceName(service: { name_ru: string; name_ky?: string | null; name_en?: string | null } | null) {
        if (!service) return t('staff.cabinet.bookings.card.serviceDefault', 'Услуга');
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    function formatText(text: string | null | undefined, defaultText: string) {
        if (!text) return defaultText;
        if (locale === 'en') return transliterate(text);
        return text;
    }

    function getStatusBadge(status: string) {
        const statusMap: Record<string, { labelKey: string; fallback: string; className: string }> = {
            hold: {
                labelKey: 'staff.cabinet.status.hold',
                fallback: 'Ожидание',
                className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
            },
            confirmed: {
                labelKey: 'staff.cabinet.status.confirmed',
                fallback: 'Подтверждено',
                className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
            },
            paid: {
                labelKey: 'staff.cabinet.status.paid',
                fallback: 'Оплачено',
                className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
            },
            cancelled: {
                labelKey: 'staff.cabinet.status.cancelled',
                fallback: 'Отменено',
                className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
            },
            no_show: {
                labelKey: 'staff.cabinet.status.noShow',
                fallback: 'Не пришел',
                className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
            },
        };

        const current = statusMap[status] || {
            labelKey: '',
            fallback: status,
            className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
        };
        const label = current.labelKey ? t(current.labelKey, current.fallback) : current.fallback;

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${current.className}`}>
                {label}
            </span>
        );
    }

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
        <Card variant="elevated" className="p-4 sm:p-6 hover:shadow-lg transition-shadow">
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
}
