'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TZ } from '@/lib/time';

type Booking = {
    id: string;
    status: string;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string; duration_min: number } | null | { name_ru: string; duration_min: number }[];
    branches: { name: string; lat: number | null; lon: number | null; address: string | null } | null | { name: string; lat: number | null; lon: number | null; address: string | null }[];
    businesses: { name: string; slug: string | null } | null | { name: string; slug: string | null }[];
};

type BranchInfo = {
    id: string;
    name: string;
    address: string | null;
};

type ServiceInfo = {
    id: string;
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
};

export default function StaffCabinet({
                                         userId: _userId,
                                         staffId: _staffId,
                                         staffName,
                                         branch,
                                         services,
                                         upcoming,
                                         past,
                                     }: {
    userId: string;
    staffId: string;
    staffName: string;
    branch: BranchInfo | null;
    services: ServiceInfo[];
    upcoming: Booking[];
    past: Booking[];
}) {
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    function formatDateTime(iso: string): string {
        return formatInTimeZone(new Date(iso), TZ, 'dd.MM.yyyy HH:mm');
    }

    function getStatusBadge(status: string) {
        const statusMap: Record<string, { label: string; className: string }> = {
            hold: { label: 'Удержание', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
            confirmed: { label: 'Подтверждена', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
            paid: { label: 'Оплачена', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
            cancelled: { label: 'Отменена', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
        };
        const s = statusMap[status] || { label: status, className: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' };
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.className}`}>
                {s.label}
            </span>
        );
    }

    const bookings = tab === 'upcoming' ? upcoming : past;

    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-indigo-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950/30">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Информация о сотруднике */}
                <Card variant="elevated" className="p-6">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">{staffName}</h1>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Информация о филиале */}
                        {branch && (
                            <div className="space-y-2">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Филиал
                                </h2>
                                <div className="pl-7 space-y-1">
                                    <p className="font-medium text-gray-900 dark:text-gray-100">{branch.name}</p>
                                    {branch.address && (
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{branch.address}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Услуги */}
                        <div className="space-y-2">
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Мои услуги ({services.length})
                            </h2>
                            {services.length === 0 ? (
                                <p className="pl-7 text-sm text-gray-500 dark:text-gray-400">Нет назначенных услуг</p>
                            ) : (
                                <div className="pl-7 space-y-2">
                                    {services.map((service) => (
                                        <div key={service.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                                            <p className="font-medium text-gray-900 dark:text-gray-100">{service.name_ru}</p>
                                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                <span>⏱ {service.duration_min} мин</span>
                                                {(service.price_from || service.price_to) && (
                                                    <span>
                                                        💰 {service.price_from && service.price_to 
                                                            ? `${service.price_from} - ${service.price_to} сом`
                                                            : service.price_from 
                                                            ? `от ${service.price_from} сом`
                                                            : `до ${service.price_to} сом`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Заголовок броней */}
                <Card variant="elevated" className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Мои записи</h2>
                            <p className="text-gray-600 dark:text-gray-400">Управляйте своими записями</p>
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
                                Предстоящие ({upcoming.length})
                            </button>
                            <button
                                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                                    tab === 'past'
                                        ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                                onClick={() => setTab('past')}
                            >
                                Прошедшие ({past.length})
                            </button>
                        </div>
                    </div>
                </Card>

                {bookings.length === 0 ? (
                    <Card variant="elevated" className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">
                            {tab === 'upcoming' ? 'Нет предстоящих записей' : 'Нет прошедших записей'}
                        </p>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {bookings.map((booking) => {
                            const clientName = booking.client_name || booking.client_phone || 'Клиент';
                            const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
                            const branch = Array.isArray(booking.branches) ? booking.branches[0] : booking.branches;
                            const business = Array.isArray(booking.businesses) ? booking.businesses[0] : booking.businesses;
                            const serviceName = service?.name_ru || 'Услуга';
                            const branchName = branch?.name || 'Филиал';
                            const businessName = business?.name || 'Бизнес';

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
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">Время</div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {formatDateTime(booking.start_at)} - {formatDateTime(booking.end_at)}
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">Клиент</div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{clientName}</div>
                                                    {booking.client_phone && (
                                                        <div className="text-sm text-gray-600 dark:text-gray-400">{booking.client_phone}</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">Филиал</div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{branchName}</div>
                                                </div>
                                                <div>
                                                    <div className="text-gray-500 dark:text-gray-400 mb-1">Бизнес</div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">{businessName}</div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <Link href={`/booking/${booking.id}`}>
                                                <Button variant="outline" size="sm">
                                                    Подробнее
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

