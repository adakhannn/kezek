'use client';

import Link from 'next/link';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';
import { transliterate } from '@/lib/transliterate';

type BookingLayoutProps = {
    id: string;
    service: { name_ru: string; name_ky: string | null; name_en: string | null } | null;
    masterName: string;
    startAt: Date;
    status: string;
    promotionApplied?: Record<string, unknown> | null;
};

export default function BookingLayoutClient({ id, service, masterName, startAt, status, promotionApplied }: BookingLayoutProps) {
    const { t, locale } = useLanguage();

    function getServiceName(): string {
        if (!service) return '—';
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        return service.name_ru;
    }

    const serviceName = getServiceName();

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
    
    // Format master name with transliteration for English locale
    const formattedMasterName = locale === 'en' ? transliterate(masterName) : masterName;
    
    // Format date in human-readable format
    const localeMap: Record<string, string> = {
        ky: 'ru-KG',
        ru: 'ru-RU',
        en: 'en-US',
    };
    
    const dateFormatter = new Intl.DateTimeFormat(localeMap[locale] || 'ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: TZ,
    });
    
    const formattedDate = dateFormatter.format(startAt);

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
                                {formattedMasterName}
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
                    
                    {/* Применённая акция */}
                    {promotionApplied && typeof promotionApplied === 'object' && 'promotion_type' in promotionApplied && (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-800 dark:bg-emerald-950/40">
                            <div className="flex items-start gap-2">
                                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-100 mb-1">
                                        {t('booking.promotionApplied', 'Применена акция:')}
                                    </p>
                                    <p className="text-xs text-emerald-800 dark:text-emerald-200">
                                        {String(promotionApplied.promotion_title || promotionApplied.promotion_type || '')}
                                        {('discount_percent' in promotionApplied && promotionApplied.discount_percent) ? ` — ${String(promotionApplied.discount_percent)}%` : ''}
                                        {('final_amount' in promotionApplied && promotionApplied.final_amount) ? (
                                            <span className="ml-2 font-semibold">
                                                {t('booking.finalAmount', 'Итоговая сумма:')} {String(promotionApplied.final_amount)} {t('booking.currency', 'сом')}
                                            </span>
                                        ) : null}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

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

