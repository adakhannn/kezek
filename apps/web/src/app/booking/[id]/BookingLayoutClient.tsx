'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

type BookingLayoutProps = {
    id: string;
    serviceName: string;
    masterName: string;
    startAt: Date;
    status: string;
};

export default function BookingLayoutClient({ id, serviceName, masterName, startAt, status }: BookingLayoutProps) {
    const { t, locale } = useLanguage();

    function getStatusLabel(status: string): { text: string; className: string } {
        const statusMap: Record<string, { textKey: string; className: string }> = {
            confirmed: { 
                textKey: 'booking.status.confirmed', 
                className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' 
            },
            paid: { 
                textKey: 'booking.status.paid', 
                className: 'bg-emerald-600 text-white dark:bg-emerald-500' 
            },
            hold: { 
                textKey: 'booking.status.hold', 
                className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' 
            },
            cancelled: { 
                textKey: 'booking.status.cancelled', 
                className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' 
            },
        };
        const s = statusMap[status] || { 
            textKey: '', 
            className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' 
        };
        const text = s.textKey ? t(s.textKey, status) : status;
        return { text, className: s.className };
    }

    const statusLabel = getStatusLabel(status);
    const shortId = id.slice(0, 8);
    const formattedDate = formatInTimeZone(startAt, TZ, 'dd.MM.yyyy HH:mm');

    return (
        <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-xl space-y-6 py-10">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-50">
                        {t('booking.title', 'Booking #{id}').replace('{id}', shortId)}
                    </h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('booking.subtitle', 'Booking confirmation and visit details')}
                    </p>
                </div>

                <section className="rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-md backdrop-blur dark:border-gray-800 dark:bg-gray-900/80 space-y-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                {t('booking.status', 'Status')}
                            </div>
                            <div className="mt-1 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold shadow-sm border border-transparent">
                                <span className={statusLabel.className + ' rounded-full px-2 py-0.5'}>
                                    {statusLabel.text}
                                </span>
                            </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                            ID: <span className="font-mono">{id}</span>
                        </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent dark:via-gray-700" />

                    <dl className="space-y-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">
                                {t('booking.service', 'Service')}
                            </dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {serviceName}
                            </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">
                                {t('booking.master', 'Master')}
                            </dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {masterName}
                            </dd>
                        </div>
                        <div className="flex items-start justify-between gap-3">
                            <dt className="text-gray-500 dark:text-gray-400">
                                {t('booking.dateTime', 'Date and time')}
                            </dt>
                            <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">
                                {formattedDate}
                            </dd>
                        </div>
                    </dl>

                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('booking.contactHint', 'If you need to change or cancel your booking, contact the salon by phone or through the contact channel specified on the business page.')}
                    </p>
                </section>

                <div className="flex justify-center">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                    >
                        {t('booking.goHome', 'Go to home')}
                    </Link>
                </div>
            </div>
        </main>
    );
}

