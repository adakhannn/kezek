'use client';

import Link from 'next/link';
import { useState } from 'react';

import BookingCard from './components/BookingCard';
import MyVisitPackagesBlock from './components/MyVisitPackagesBlock';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs } from '@/components/ui/Tabs';
import { buttonStyles } from '@/components/ui/buttonStyles';

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
                return t('cabinet.bookings.subtitle.upcoming.one', 'Р Р€ РІРВ°РЎРѓ 1 РїСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РВ°РЎРЏ РВ·РВ°пись');
            }
            if (count < 5) {
                return t('cabinet.bookings.subtitle.upcoming.few', 'Р Р€ РІРВ°РЎРѓ {count} РїСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёРВµ РВ·РВ°писи').replace(
                    '{count}',
                    String(count),
                );
            }
            return t('cabinet.bookings.subtitle.upcoming.many', 'Р Р€ РІРВ°РЎРѓ {count} РїСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёСвЂ¦ РВ·РВ°Р С—Р С‘РЎРѓР ВµРв„–').replace(
                '{count}',
                String(count),
            );
        }

        const count = past.length;
        if (count === 1) {
            return t('cabinet.bookings.subtitle.past.one', 'Р Р€ РІРВ°РЎРѓ 1 Р С—РЎР‚Р С•РЎв‚¬РВµРТ‘Св‚¬РВ°РЎРЏ РВ·РВ°пись');
        }
        if (count < 5) {
            return t('cabinet.bookings.subtitle.past.few', 'Р Р€ РІРВ°РЎРѓ {count} Р С—РЎР‚Р С•РЎв‚¬РВµРТ‘Св‚¬РёРВµ РВ·РВ°писи').replace(
                '{count}',
                String(count),
            );
        }
        return t('cabinet.bookings.subtitle.past.many', 'Р Р€ РІРВ°РЎРѓ {count} Р С—РЎР‚Р С•РЎв‚¬РВµРТ‘Св‚¬РёСвЂ¦ РВ·РВ°Р С—Р С‘РЎРѓР ВµРв„–').replace(
            '{count}',
            String(count),
        );
    };

    return (
        <div className="space-y-6">
            <MyVisitPackagesBlock />

            <PageHeader
                title={t('cabinet.bookings.title', 'Мои РВ·РВ°писи')}
                description={getSubtitle()}
                actions={
                    <div className="w-full sm:w-[24rem]">
                        <Tabs
                            value={tab}
                            onValueChange={(value) => setTab(value as 'upcoming' | 'past')}
                            items={[
                                {
                                    key: 'upcoming',
                                    label: t('cabinet.bookings.tabs.upcoming', 'РџСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёРВµ'),
                                },
                                {
                                    key: 'past',
                                    label: t('cabinet.bookings.tabs.past', 'Р СџРЎР‚Р С•РЎв‚¬РВµРТ‘Св‚¬РёРВµ'),
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
                            title={t('cabinet.bookings.empty.upcoming.title', 'РќРВµт РїСЂРВµРТ‘СЃС‚РѕСЏСвЂ°РёСвЂ¦ РВ·РВ°Р С—Р С‘РЎРѓР ВµРв„–')}
                            description={t('cabinet.bookings.empty.upcoming.desc', 'РвЂ”РВ°РїРёСв‚¬РёС‚РВµСЃСЊ РЅРВ° СѓСЃРВ»угу, чтРѕРВ±СвЂ№ РЎС“Р Р†Р С‘Р Т‘РВµтСЊ РВµСвЂ РВ·РТ‘РВµСЃСЊ')}
                            action={
                                <Link href="/" className={buttonStyles({ variant: 'primary', size: 'lg' })}>
                                    {t('cabinet.bookings.empty.upcoming.action', 'РќРВ°Рв„–тРё СѓСЃРВ»угу')}
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
                            title={t('cabinet.bookings.empty.past.title', 'РќРВµт Р С—РЎР‚Р С•РЎв‚¬РВµРТ‘Св‚¬РёСвЂ¦ РВ·РВ°Р С—Р С‘РЎРѓР ВµРв„–')}
                            description={t('cabinet.bookings.empty.past.desc', 'РвЂ”РТ‘РВµСЃСЊ РВ±СѓРТ‘СѓС‚ РѕС‚РѕРВ±СЂРВ°РВ¶РВ°С‚РЎРЉРЎРѓРЎРЏ РІРВ°Св‚¬Р С‘ РВ·РВ°РІРВµСЂСв‚¬СвЂРЅРЅСвЂ№РВµ РВ·РВ°писи')}
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

