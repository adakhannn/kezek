'use client';

import Link from 'next/link';

import StaffAvatarUpload from './avatar/StaffAvatarUpload';
import { StaffOnboarding } from './components/StaffOnboarding';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { transliterate } from '@/lib/transliterate';


type BranchInfo = {
    id: string;
    name: string;
    address: string | null;
};

type ServiceInfo = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
};

export default function StaffCabinet({
                                         userId: _userId,
                                         staffId,
                                         staffName,
                                         avatarUrl,
                                         branch,
                                         services,
                                         upcoming,
                                         past,
                                     }: {
    userId: string;
    staffId: string;
    staffName: string;
    avatarUrl: string | null;
    branch: BranchInfo | null;
    services: ServiceInfo[];
    upcoming: unknown[];
    past: unknown[];
}) {
    const { t, locale } = useLanguage();

    function getServiceName(service: ServiceInfo): string {
        if (locale === 'ky' && service.name_ky) return service.name_ky;
        if (locale === 'en' && service.name_en) return service.name_en;
        if (locale === 'en') return transliterate(service.name_ru);
        return service.name_ru;
    }

    function formatText(text: string | null | undefined): string {
        if (!text) return '';
        if (locale === 'en') return transliterate(text);
        return text;
    }

    function formatStaffName(name: string | null | undefined): string {
        if (!name) return '';
        if (locale === 'en') return transliterate(name);
        return name;
    }

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-6xl px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
                <StaffOnboarding />
                {/* Информация о сотруднике */}
                <Card variant="elevated" className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-4 sm:mb-6">
                        <div className="flex-shrink-0 mx-auto sm:mx-0">
                            <StaffAvatarUpload
                                staffId={staffId}
                                currentAvatarUrl={avatarUrl}
                                onUploaded={() => {
                                    // Обновляем страницу после загрузки
                                    window.location.reload();
                                }}
                            />
                        </div>
                        <div className="flex-1 text-center sm:text-left">
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {formatStaffName(staffName) || t('staff.cabinet.title', 'Кабинет сотрудника')}
                            </h1>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                        {/* Информация о филиале */}
                        {branch && (
                            <div className="space-y-2">
                                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {t('staff.cabinet.branch', 'Филиал')}
                                </h2>
                                <div className="pl-7 space-y-1">
                                    <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{formatText(branch.name)}</p>
                                    {branch.address && (
                                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 break-words">{formatText(branch.address)}</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Услуги */}
                        <div className="space-y-2">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                {t('staff.cabinet.services', 'Мои услуги')} ({services.length})
                            </h2>
                            {services.length === 0 ? (
                                <p className="pl-7 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                                    {t('staff.cabinet.services.empty', 'Нет назначенных услуг')}
                                </p>
                            ) : (
                                <div className="pl-7 space-y-2">
                                    {services.map((service) => (
                                        <div key={service.id} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                                            <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100">{getServiceName(service)}</p>
                                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                                                <span>⏱ {service.duration_min} {t('staff.cabinet.services.duration', 'мин')}</span>
                                                {(service.price_from || service.price_to) && (
                                                    <span>
                                                        💰 {service.price_from && service.price_to
                                                            ? t('staff.cabinet.services.priceBetween', '{from} - {to} сом').replace('{from}', String(service.price_from)).replace('{to}', String(service.price_to))
                                                            : service.price_from
                                                            ? t('staff.cabinet.services.priceFromValue', 'от {price} сом').replace('{price}', String(service.price_from))
                                                            : t('staff.cabinet.services.priceToValue', 'до {price} сом').replace('{price}', String(service.price_to))}
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

                {/* Краткая информация о записях с ссылкой на полный список */}
                <Card variant="elevated" className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                                {t('staff.cabinet.bookings.title', 'Мои записи')}
                            </h2>
                            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                                {t('staff.cabinet.bookings.subtitle', 'Управляйте своими записями')}
                            </p>
                        </div>
                        <Link href="/staff/bookings" className="w-full sm:w-auto">
                            <Button variant="primary" size="md" className="w-full sm:w-auto">
                                {t('staff.cabinet.bookings.viewAll', 'Посмотреть все записи')}
                            </Button>
                        </Link>
                    </div>
                    <div className="mt-4 sm:mt-6 grid grid-cols-2 gap-3 sm:gap-4">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {t('staff.cabinet.bookings.tabs.upcoming', 'Предстоящие')}
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                                {upcoming.length}
                            </div>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 sm:p-4">
                            <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {t('staff.cabinet.bookings.tabs.past', 'Прошедшие')}
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {past.length}
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </main>
    );
}

