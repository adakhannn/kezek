'use client';

import { formatInTimeZone } from 'date-fns-tz';
import Link from 'next/link';

import StaffForm from '../StaffForm';

import DangerActions from './DangerActions';
import StaffServicesEditor from './StaffServicesEditor';
import TransferStaffDialog from './TransferStaffDialog';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { TZ } from '@/lib/time';

type Branch = { id: string; name: string; is_active: boolean };
type StaffData = {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    branch_id: string;
    is_active: boolean;
    percent_master: number | null;
    percent_salon: number | null;
    hourly_rate: number | null;
};
type Review = {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    booking_id: string;
    service_name: string | null;
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
};

type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

export default function StaffDetailPageClient({
    staff,
    branches,
    reviews,
    ratingScore,
    ratingWeights,
}: {
    staff: StaffData;
    branches: Branch[];
    reviews: Review[];
    ratingScore?: number | null;
    ratingWeights?: RatingWeights | null;
}) {
    const { t } = useLanguage();

    const activeBranches = branches.filter((b) => b.is_active);
    const currentBranch = branches.find((b) => b.id === staff.branch_id);
    const effectiveRatingScore = typeof ratingScore === 'number' ? ratingScore : null;

    const getRatingAdvice = () => {
        if (effectiveRatingScore === null) {
            return t(
                'staff.rating.advice.noScore',
                'Р РµР№С‚РёРЅРі РѕР±РЅРѕРІР»СЏРµС‚СЃСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЂР°Р· РІ СЃСѓС‚РєРё. РЎРѕСЃСЂРµРґРѕС‚РѕС‡СЊС‚РµСЃСЊ РЅР° СЃС‚Р°Р±РёР»СЊРЅРѕРј РєР°С‡РµСЃС‚РІРµ СЃРµСЂРІРёСЃР°.',
            );
        }
        if (effectiveRatingScore < 60) {
            return t(
                'staff.rating.advice.low',
                'РќСѓР¶РЅРѕ РїРѕРґС‚СЏРЅСѓС‚СЊ Р±Р°Р·Сѓ: РїСЂРѕСЃРёС‚Рµ РєР»РёРµРЅС‚РѕРІ РѕСЃС‚Р°РІР»СЏС‚СЊ РѕС‚Р·С‹РІС‹, СЃР»РµРґРёС‚Рµ Р·Р° РїСѓРЅРєС‚СѓР°Р»СЊРЅРѕСЃС‚СЊСЋ Рё РЅРµ РїСЂРѕРїСѓСЃРєР°Р№С‚Рµ СЃРјРµРЅС‹.',
            );
        }
        if (effectiveRatingScore < 80) {
            return t(
                'staff.rating.advice.medium',
                'РҐРѕСЂРѕС€РёР№ СѓСЂРѕРІРµРЅСЊ. Р”Р»СЏ СЂРѕСЃС‚Р° СЂРµР№С‚РёРЅРіР°: СЃС‚Р°Р±РёР»СЊРЅРѕ РІС‹СЃРѕРєРёРµ РѕС†РµРЅРєРё, РјРµРЅСЊС€Рµ РѕРїРѕР·РґР°РЅРёР№ Рё Р±РѕР»СЊС€Рµ РІРѕР·РІСЂР°С‰Р°СЋС‰РёС…СЃСЏ РєР»РёРµРЅС‚РѕРІ.',
            );
        }
        return t(
            'staff.rating.advice.high',
            'РћС‚Р»РёС‡РЅС‹Р№ СЂРµР№С‚РёРЅРі. Р’Р°Р¶РЅРѕ СѓРґРµСЂР¶РёРІР°С‚СЊ РєР°С‡РµСЃС‚РІРѕ: РЅРµ СЃРЅРёР¶Р°С‚СЊ СѓСЂРѕРІРµРЅСЊ СЃРµСЂРІРёСЃР°, РІРѕРІСЂРµРјСЏ РІС‹С…РѕРґРёС‚СЊ РЅР° СЃРјРµРЅС‹ Рё СЂР°Р±РѕС‚Р°С‚СЊ СЃ РїРѕСЃС‚РѕСЏРЅРЅС‹РјРё РєР»РёРµРЅС‚Р°РјРё.',
        );
    };

    const getServiceName = (serviceName: string | null): string => {
        if (!serviceName) return '';
        return serviceName;
    };

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                <div className="px-6 py-6 lg:px-8 lg:py-7">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/dashboard/staff"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 transition-colors hover:bg-white/20"
                                    title={t('staff.detail.back.title', 'РќР°Р·Р°Рґ Рє СЃРїРёСЃРєСѓ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ')}
                                >
                                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </Link>
                                <div>
                                    <h1 className="type-page-title">{staff.full_name}</h1>
                                    <div className="mt-2 flex flex-wrap items-center gap-3">
                                        <div className="type-label inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                                            {staff.is_active ? (
                                                <>
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                                                    {t('staff.detail.status.active', 'РђРєС‚РёРІРµРЅ')}
                                                </>
                                            ) : (
                                                <>
                                                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-gray-400" />
                                                    {t('staff.detail.status.inactive', 'РќРµР°РєС‚РёРІРµРЅ')}
                                                </>
                                            )}
                                        </div>
                                        {currentBranch && (
                                            <div className="type-label inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1">
                                                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                                </svg>
                                                {currentBranch.name}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                className="type-label inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
                                href={`/dashboard/staff/${staff.id}/schedule`}
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {t('staff.detail.nav.schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ')}
                            </Link>
                            <Link
                                className="type-label inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
                                href={`/dashboard/staff/${staff.id}/slots`}
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {t('staff.detail.nav.slots', 'РЎРІРѕР±РѕРґРЅС‹Рµ СЃР»РѕС‚С‹')}
                            </Link>
                            <Link
                                className="type-label inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
                                href={`/dashboard/staff/${staff.id}/finance`}
                            >
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h4v11H3zM10 3h4v18h-4zM17 8h4v13h-4z" />
                                </svg>
                                {t('staff.detail.nav.finance', 'Р¤РёРЅР°РЅСЃС‹')}
                            </Link>
                            {activeBranches.length > 1 && (
                                <TransferStaffDialog
                                    staffId={String(staff.id)}
                                    currentBranchId={String(staff.branch_id)}
                                    branches={activeBranches.map((b) => ({ id: String(b.id), name: String(b.name) }))}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {ratingWeights && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-2">
                            <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            </div>
                            <div>
                                <p className="type-label text-amber-900 dark:text-amber-100">
                                    {t('staff.rating.title', 'Р РµР№С‚РёРЅРі СЃРѕС‚СЂСѓРґРЅРёРєР° РІ Kezek')}
                                </p>
                                <p className="type-caption mt-0.5 text-amber-800/80 dark:text-amber-200/90">
                                    {t(
                                        'staff.rating.subtitle',
                                        'РљР°Р¶РґС‹Р№ СЂР°Р±РѕС‡РёР№ РґРµРЅСЊ РІР»РёСЏРµС‚ РЅР° СЂРµР№С‚РёРЅРі Р·Р° РїРѕСЃР»РµРґРЅРёРµ {days} РґРЅРµР№.',
                                    ).replace('{days}', String(ratingWeights.windowDays))}
                                </p>
                                <div className="type-label mt-2 flex flex-wrap gap-2 text-amber-900/90 dark:text-amber-100">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {t('dashboard.rating.factor.reviews', 'РћС‚Р·С‹РІС‹')}: {ratingWeights.reviews}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        {t('dashboard.rating.factor.productivity', 'РљРѕР»РёС‡РµСЃС‚РІРѕ РєР»РёРµРЅС‚РѕРІ')}:{' '}
                                        {ratingWeights.productivity}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                        {t('dashboard.rating.factor.loyalty', 'Р’РѕР·РІСЂР°С‰Р°РµРјРѕСЃС‚СЊ РєР»РёРµРЅС‚РѕРІ')}:{' '}
                                        {ratingWeights.loyalty}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                        {t('dashboard.rating.factor.discipline', 'Р”РёСЃС†РёРїР»РёРЅР° (РѕРїРѕР·РґР°РЅРёСЏ)')}:{' '}
                                        {ratingWeights.discipline}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:flex-col sm:items-end sm:justify-center">
                            {effectiveRatingScore !== null ? (
                                <div className="inline-flex flex-col items-end gap-0.5">
                                    <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/80 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/50 dark:text-amber-50">
                                        <span className="type-label uppercase tracking-[0.08em]">
                                            {t('staff.rating.scoreLabel', 'РўРµРєСѓС‰РёР№ Р±Р°Р»Р»')}
                                        </span>
                                        <span className="type-metric text-[1.75rem]">{effectiveRatingScore.toFixed(1)}</span>
                                        <span className="type-caption opacity-70">/ 100</span>
                                    </div>
                                    {effectiveRatingScore <= 10 && (
                                        <span className="type-caption text-amber-700 dark:text-amber-300">
                                            {t('common.rating.lowRatingHint', 'РЅРёР·РєРёР№ СЂРµР№С‚РёРЅРі')}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/60 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-50">
                                    <span className="type-label uppercase tracking-[0.08em]">
                                        {t('common.rating.noRating', 'РќРµС‚ СЂРµР№С‚РёРЅРіР°')}
                                    </span>
                                </div>
                            )}
                            <p className="type-caption max-w-[220px] text-amber-800/80 dark:text-amber-200/80">
                                {getRatingAdvice()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeBranches.length === 0 && (
                <div className="rounded-xl border border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50 p-4 shadow-md dark:border-yellow-800 dark:from-yellow-900/20 dark:to-orange-900/20">
                    <div className="flex items-start gap-3">
                        <svg className="mt-0.5 h-6 w-6 flex-shrink-0 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="type-body text-gray-700 dark:text-gray-300">
                            <p className="type-label mb-1 text-gray-900 dark:text-gray-100">
                                {t('staff.detail.warning.noBranches.title', 'Р’ СЌС‚РѕРј Р±РёР·РЅРµСЃРµ РµС‰С‘ РЅРµС‚ Р°РєС‚РёРІРЅС‹С… С„РёР»РёР°Р»РѕРІ')}
                            </p>
                            <p className="type-caption text-gray-600 dark:text-gray-400">
                                {t('staff.detail.warning.noBranches.desc', 'РЎРѕР·РґР°Р№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С„РёР»РёР°Р», С‡С‚РѕР±С‹ РЅР°Р·РЅР°С‡РёС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР°.')}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="type-section-title flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t('staff.detail.sections.mainInfo.title', 'РћСЃРЅРѕРІРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ')}
                    </h2>
                    <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                        {t('staff.detail.sections.mainInfo.desc', 'Р›РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ Рё РєРѕРЅС‚Р°РєС‚С‹ СЃРѕС‚СЂСѓРґРЅРёРєР°')}
                    </p>
                </div>
                <StaffForm
                    initial={{
                        id: String(staff.id),
                        full_name: String(staff.full_name),
                        email: staff.email ?? null,
                        phone: staff.phone ?? null,
                        branch_id: String(staff.branch_id),
                        is_active: Boolean(staff.is_active),
                        percent_master: Number(staff.percent_master ?? 60),
                        percent_salon: Number(staff.percent_salon ?? 40),
                        hourly_rate: staff.hourly_rate !== null && staff.hourly_rate !== undefined ? Number(staff.hourly_rate) : null,
                    }}
                    apiBase="/api/staff"
                />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6">
                    <h2 className="type-section-title flex items-center gap-2 text-gray-900 dark:text-gray-100">
                        <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {t('staff.detail.sections.competencies.title', 'РљРѕРјРїРµС‚РµРЅС†РёРё')}
                    </h2>
                    <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                        {t('staff.detail.sections.competencies.desc', 'РЈСЃР»СѓРіРё, РєРѕС‚РѕСЂС‹Рµ РІС‹РїРѕР»РЅСЏРµС‚ СЌС‚РѕС‚ СЃРѕС‚СЂСѓРґРЅРёРє')}
                    </p>
                </div>
                <StaffServicesEditor staffId={String(staff.id)} staffBranchId={String(staff.branch_id)} />
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="type-section-title flex items-center gap-2 text-gray-900 dark:text-gray-100">
                            <svg className="h-5 w-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            {t('staff.detail.sections.reviews.title', 'РћС‚Р·С‹РІС‹')}
                        </h2>
                        <p className="type-caption mt-1 text-gray-500 dark:text-gray-400">
                            {t('staff.detail.sections.reviews.desc', 'РћС‚Р·С‹РІС‹ РєР»РёРµРЅС‚РѕРІ Рѕ СЂР°Р±РѕС‚Рµ СЃРѕС‚СЂСѓРґРЅРёРєР°')}
                        </p>
                    </div>
                    {reviews.length > 0 && (
                        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 dark:bg-indigo-950/40">
                            <span className="type-body font-semibold text-indigo-700 dark:text-indigo-300">
                                {reviews.length}
                            </span>
                            <span className="type-caption text-indigo-600 dark:text-indigo-400">
                                {t('staff.detail.reviews.count', 'РѕС‚Р·С‹РІРѕРІ')}
                            </span>
                        </div>
                    )}
                </div>

                {reviews.length === 0 ? (
                    <div className="py-12 text-center">
                        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                        </div>
                        <p className="type-body text-gray-500 dark:text-gray-400">
                            {t('staff.detail.reviews.empty', 'РџРѕРєР° РЅРµС‚ РѕС‚Р·С‹РІРѕРІ')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviews.map((review) => {
                            const dateStr = formatInTimeZone(new Date(review.start_at), TZ, 'dd.MM.yyyy HH:mm');

                            return (
                                <div
                                    key={review.id}
                                    className="rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-md dark:border-gray-700"
                                >
                                    <div className="mb-3 flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="mb-1 flex items-center gap-2">
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: 5 }).map((_, i) => (
                                                        <svg
                                                            key={i}
                                                            className={`h-5 w-5 ${i < review.rating ? 'fill-current text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                                                            fill="currentColor"
                                                            viewBox="0 0 20 20"
                                                        >
                                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                        </svg>
                                                    ))}
                                                </div>
                                                <span className="type-body font-medium text-gray-700 dark:text-gray-300">
                                                    {review.rating}в…
                                                </span>
                                            </div>
                                            {review.service_name && (
                                                <p className="type-body mb-1 text-gray-600 dark:text-gray-400">
                                                    {t('staff.detail.reviews.service', 'РЈСЃР»СѓРіР°:')}{' '}
                                                    <span className="font-medium">{getServiceName(review.service_name)}</span>
                                                </p>
                                            )}
                                            <p className="type-caption text-gray-500 dark:text-gray-500">
                                                {dateStr} вЂў{' '}
                                                {review.client_name ||
                                                    review.client_phone ||
                                                    t('staff.detail.reviews.client', 'РљР»РёРµРЅС‚')}
                                            </p>
                                        </div>
                                    </div>
                                    {review.comment && (
                                        <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                                            <p className="type-body whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                                {review.comment}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
                <p className="type-caption text-gray-600 dark:text-gray-400">
                    {t('staff.detail.transfer.note', 'Р’СЂРµРјРµРЅРЅС‹Рµ РїРµСЂРµРІРѕРґС‹ РјРµР¶РґСѓ С„РёР»РёР°Р»Р°РјРё Р·Р°РґР°СЋС‚СЃСЏ РІ СЂР°Р·РґРµР»Рµ')}{' '}
                    <Link href={`/dashboard/staff/${staff.id}/schedule`} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        {t('staff.detail.transfer.scheduleLink', 'В«Р Р°СЃРїРёСЃР°РЅРёРµВ»')}
                    </Link>
                    .
                </p>
            </div>

            <DangerActions staffId={String(staff.id)} />
        </div>
    );
}
