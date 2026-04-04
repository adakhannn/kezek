'use client';

import Link from 'next/link';
import { useState } from 'react';

import BookingCard from './components/BookingCard';
import MyVisitPackagesBlock from './components/MyVisitPackagesBlock';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { buttonStyles } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';

type Booking = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    promotion_applied?: Record<string, unknown> | null;
    subscription_applied?: Record<string, unknown> | null;
    service_id?: string | null;
    staff_id?: string | null;
    branch_id?: string | null;
    biz_id?: string | null;
    services?:
        | { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }[]
        | { id: string; name_ru: string; name_ky?: string | null; name_en?: string | null; duration_min: number }
        | null;
    staff?: { id: string; full_name: string }[] | { id: string; full_name: string } | null;
    branches?:
        | { id: string; name: string; lat: number | null; lon: number | null; address: string | null }[]
        | { id: string; name: string; lat: number | null; lon: number | null; address: string | null }
        | null;
    businesses?: { id: string; name: string; slug: string }[] | { id: string; name: string; slug: string } | null;
    reviews?: { id: string; rating: number; comment: string | null }[] | null;
};

function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

function extractReview(
    reviews:
        | { id: string; rating: number; comment: string | null }[]
        | { id: string; rating: number; comment: string | null }
        | null
        | undefined,
): { id: string; rating: number; comment: string | null } | null {
    if (!reviews) return null;
    if (Array.isArray(reviews)) {
        return reviews.length > 0 ? reviews[0] : null;
    }
    return reviews;
}

export default function ClientCabinet({
    userId: _userId,
    upcoming,
    past,
}: {
    userId: string;
    upcoming: Booking[];
    past: Booking[];
}) {
    const { t } = useLanguage();
    const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

    const getSubtitle = () => {
        if (tab === 'upcoming') {
            const count = upcoming.length;
            if (count === 1) {
                return t('cabinet.bookings.subtitle.upcoming.one', 'Р Р€ Р Р†Р В°РЎРѓ 1 Р С—РЎР‚Р ВµР Т‘РЎРѓРЎвЂљР С•РЎРЏРЎвЂ°Р В°РЎРЏ Р В·Р В°Р С—Р С‘РЎРѓРЎРЉ');
            }
            if (count < 5) {
                return t('cabinet.bookings.subtitle.upcoming.few', 'Р Р€ Р Р†Р В°РЎРѓ {count} Р С—РЎР‚Р ВµР Т‘РЎРѓРЎвЂљР С•РЎРЏРЎвЂ°Р С‘Р Вµ Р В·Р В°Р С—Р С‘РЎРѓР С‘').replace(
                    '{count}',
                    String(count),
                );
            }
            return t('cabinet.bookings.subtitle.upcoming.many', 'Р Р€ Р Р†Р В°РЎРѓ {count} Р С—РЎР‚Р ВµР Т‘РЎРѓРЎвЂљР С•РЎРЏРЎвЂ°Р С‘РЎвЂ¦ Р В·Р В°Р С—Р С‘РЎРѓР ВµР в„–').replace(
                '{count}',
                String(count),
            );
        }

        const count = past.length;
        if (count === 1) {
            return t('cabinet.bookings.subtitle.past.one', 'Р Р€ Р Р†Р В°РЎРѓ 1 Р С—РЎР‚Р С•РЎв‚¬Р ВµР Т‘РЎв‚¬Р В°РЎРЏ Р В·Р В°Р С—Р С‘РЎРѓРЎРЉ');
        }
        if (count < 5) {
            return t('cabinet.bookings.subtitle.past.few', 'Р Р€ Р Р†Р В°РЎРѓ {count} Р С—РЎР‚Р С•РЎв‚¬Р ВµР Т‘РЎв‚¬Р С‘Р Вµ Р В·Р В°Р С—Р С‘РЎРѓР С‘').replace(
                '{count}',
                String(count),
            );
        }
        return t('cabinet.bookings.subtitle.past.many', 'Р Р€ Р Р†Р В°РЎРѓ {count} Р С—РЎР‚Р С•РЎв‚¬Р ВµР Т‘РЎв‚¬Р С‘РЎвЂ¦ Р В·Р В°Р С—Р С‘РЎРѓР ВµР в„–').replace(
            '{count}',
            String(count),
        );
    };

    return (
        <div className="space-y-6">
            <MyVisitPackagesBlock />

            <PageHeader
                title={t('cabinet.bookings.title', 'Р СљР С•Р С‘ Р В·Р В°Р С—Р С‘РЎРѓР С‘')}
                description={getSubtitle()}
                actions={
                    <div className="w-full sm:w-[24rem]">
                        <Tabs
                            value={tab}
                            onValueChange={(value) => setTab(value as 'upcoming' | 'past')}
                            items={[
                                {
                                    key: 'upcoming',
                                    label: t('cabinet.bookings.tabs.upcoming', 'Р СџРЎР‚Р ВµР Т‘РЎРѓРЎвЂљР С•РЎРЏРЎвЂ°Р С‘Р Вµ'),
                                },
                                {
                                    key: 'past',
                                    label: t('cabinet.bookings.tabs.past', 'Р СџРЎР‚Р С•РЎв‚¬Р ВµР Т‘РЎв‚¬Р С‘Р Вµ'),
                                },
                            ]}
                            stretch
                        />
                    </div>
                }
            />

            {tab === 'upcoming' && (
                <section className="space-y-4">
                    {upcoming.length === 0 ? (
                        <EmptyState
                            icon={
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            }
                            title={t('cabinet.bookings.empty.upcoming.title', 'Р СњР ВµРЎвЂљ Р С—РЎР‚Р ВµР Т‘РЎРѓРЎвЂљР С•РЎРЏРЎвЂ°Р С‘РЎвЂ¦ Р В·Р В°Р С—Р С‘РЎРѓР ВµР в„–')}
                            description={t('cabinet.bookings.empty.upcoming.desc', 'Р вЂ”Р В°Р С—Р С‘РЎв‚¬Р С‘РЎвЂљР ВµРЎРѓРЎРЉ Р Р…Р В° РЎС“РЎРѓР В»РЎС“Р С–РЎС“, РЎвЂЎРЎвЂљР С•Р В±РЎвЂ№ РЎС“Р Р†Р С‘Р Т‘Р ВµРЎвЂљРЎРЉ Р ВµРЎвЂ Р В·Р Т‘Р ВµРЎРѓРЎРЉ')}
                            action={
                                <Link href="/" className={buttonStyles({ variant: 'primary', size: 'lg' })}>
                                    {t('cabinet.bookings.empty.upcoming.action', 'Р СњР В°Р в„–РЎвЂљР С‘ РЎС“РЎРѓР В»РЎС“Р С–РЎС“')}
                                </Link>
                            }
                        />
                    ) : (
                        upcoming.map((b) => {
                            const servicesArray = b.services ? (Array.isArray(b.services) ? b.services : [b.services]) : [];
                            const service = servicesArray[0] ?? null;
                            const staff = first(b.staff);
                            const branch = first(b.branches);
                            const business = first(b.businesses);

                            return (
                                <BookingCard
                                    key={b.id}
                                    bookingId={b.id}
                                    status={b.status}
                                    start_at={b.start_at}
                                    end_at={b.end_at}
                                    service={
                                        service
                                            ? {
                                                  id: service.id,
                                                  name_ru: service.name_ru,
                                                  name_ky: service.name_ky || null,
                                                  name_en: service.name_en || null,
                                                  duration_min: service.duration_min,
                                              }
                                            : null
                                    }
                                    servicesList={servicesArray.map((s) => ({
                                        id: s.id,
                                        name_ru: s.name_ru,
                                        name_ky: s.name_ky || null,
                                        name_en: s.name_en || null,
                                        duration_min: s.duration_min,
                                    }))}
                                    staff={staff ? { id: staff.id, full_name: staff.full_name } : null}
                                    branch={branch ? { id: branch.id, name: branch.name, lat: branch.lat, lon: branch.lon, address: branch.address } : null}
                                    business={business ? { id: business.id, name: business.name, slug: business.slug } : null}
                                    serviceId={b.service_id ?? service?.id}
                                    staffId={b.staff_id ?? staff?.id}
                                    branchId={b.branch_id ?? branch?.id}
                                    bizId={b.biz_id ?? business?.id}
                                    review={extractReview(b.reviews)}
                                    promotionApplied={b.promotion_applied}
                                    subscriptionApplied={b.subscription_applied}
                                    canCancel
                                />
                            );
                        })
                    )}
                </section>
            )}

            {tab === 'past' && (
                <section className="space-y-4">
                    {past.length === 0 ? (
                        <EmptyState
                            compact
                            icon={
                                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                            title={t('cabinet.bookings.empty.past.title', 'Р СњР ВµРЎвЂљ Р С—РЎР‚Р С•РЎв‚¬Р ВµР Т‘РЎв‚¬Р С‘РЎвЂ¦ Р В·Р В°Р С—Р С‘РЎРѓР ВµР в„–')}
                            description={t('cabinet.bookings.empty.past.desc', 'Р вЂ”Р Т‘Р ВµРЎРѓРЎРЉ Р В±РЎС“Р Т‘РЎС“РЎвЂљ Р С•РЎвЂљР С•Р В±РЎР‚Р В°Р В¶Р В°РЎвЂљРЎРЉРЎРѓРЎРЏ Р Р†Р В°РЎв‚¬Р С‘ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬РЎвЂР Р…Р Р…РЎвЂ№Р Вµ Р В·Р В°Р С—Р С‘РЎРѓР С‘')}
                        />
                    ) : (
                        past.map((b) => {
                            const servicesArray = b.services ? (Array.isArray(b.services) ? b.services : [b.services]) : [];
                            const service = servicesArray[0] ?? null;
                            const staff = first(b.staff);
                            const branch = first(b.branches);
                            const business = first(b.businesses);

                            return (
                                <BookingCard
                                    key={b.id}
                                    bookingId={b.id}
                                    status={b.status}
                                    start_at={b.start_at}
                                    end_at={b.end_at}
                                    service={
                                        service
                                            ? {
                                                  id: service.id,
                                                  name_ru: service.name_ru,
                                                  name_ky: service.name_ky || null,
                                                  name_en: service.name_en || null,
                                                  duration_min: service.duration_min,
                                              }
                                            : null
                                    }
                                    servicesList={servicesArray.map((s) => ({
                                        id: s.id,
                                        name_ru: s.name_ru,
                                        name_ky: s.name_ky || null,
                                        name_en: s.name_en || null,
                                        duration_min: s.duration_min,
                                    }))}
                                    staff={staff ? { id: staff.id, full_name: staff.full_name } : null}
                                    branch={branch ? { id: branch.id, name: branch.name, lat: branch.lat, lon: branch.lon, address: branch.address } : null}
                                    business={business ? { id: business.id, name: business.name, slug: business.slug } : null}
                                    serviceId={b.service_id ?? service?.id}
                                    staffId={b.staff_id ?? staff?.id}
                                    branchId={b.branch_id ?? branch?.id}
                                    bizId={b.biz_id ?? business?.id}
                                    review={extractReview(b.reviews)}
                                    subscriptionApplied={b.subscription_applied}
                                    canCancel={false}
                                />
                            );
                        })
                    )}
                </section>
            )}
        </div>
    );
}
