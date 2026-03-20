'use client';

import Link from 'next/link';

import StaffForm from '../StaffForm';

import DangerActions from './DangerActions';
import { StaffReviewsSection } from './StaffReviewsSection';
import StaffServicesEditor from './StaffServicesEditor';
import TransferStaffDialog from './TransferStaffDialog';
import {
    getEffectiveRatingScore,
    getRatingAdvice,
} from './staffDetailHelpers';
import type {
    Branch,
    RatingWeights,
    Review,
    StaffData,
} from './staffDetailTypes';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

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
    const { t, locale: _locale } = useLanguage();

    const activeBranches = branches.filter((b) => b.is_active);
    const currentBranch = branches.find((b) => b.id === staff.branch_id);
    const effectiveRatingScore = getEffectiveRatingScore(ratingScore);

    return (
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-6">
            {/* Р—Р°РіРѕР»РѕРІРѕРє СЃ РёРЅС„РѕСЂРјР°С†РёРµР№ Рѕ СЃРѕС‚СЂСѓРґРЅРёРєРµ */}
            <div className="rounded-2xl bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-500 text-white shadow-lg">
                <div className="px-6 py-6 lg:px-8 lg:py-7">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Link
                                    href="/dashboard/staff"
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    title={t('staff.detail.back.title', 'РќР°Р·Р°Рґ Рє СЃРїРёСЃРєСѓ СЃРѕС‚СЂСѓРґРЅРёРєРѕРІ')}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                    </svg>
                                </Link>
                                <div>
                                    <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">{staff.full_name}</h1>
                                    <div className="flex items-center gap-3 flex-wrap mt-2">
                                        <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
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
                                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                        <div className="flex items-center gap-2 flex-wrap">
                            <Link
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                href={`/dashboard/staff/${staff.id}/schedule`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {t('staff.detail.nav.schedule', 'Р Р°СЃРїРёСЃР°РЅРёРµ')}
                            </Link>
                            <Link
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                href={`/dashboard/staff/${staff.id}/slots`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {t('staff.detail.nav.slots', 'РЎРІРѕР±РѕРґРЅС‹Рµ СЃР»РѕС‚С‹')}
                            </Link>
                            <Link
                                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                                href={`/dashboard/staff/${staff.id}/finance`}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* РћР±СЉСЏСЃРЅРµРЅРёРµ СЂРµР№С‚РёРЅРіР° СЃРѕС‚СЂСѓРґРЅРёРєР° */}
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
                                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                                    {t('staff.rating.title', 'Р РµР№С‚РёРЅРі СЃРѕС‚СЂСѓРґРЅРёРєР° РІ Kezek')}
                                </p>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/90">
                                    {t(
                                        'staff.rating.subtitle',
                                        'РљР°Р¶РґС‹Р№ СЂР°Р±РѕС‡РёР№ РґРµРЅСЊ РІР»РёСЏРµС‚ РЅР° СЂРµР№С‚РёРЅРі Р·Р° РїРѕСЃР»РµРґРЅРёРµ {days} РґРЅРµР№.',
                                    ).replace('{days}', String(ratingWeights.windowDays))}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900/90 dark:text-amber-100">
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
                                        <span className="text-xs font-medium uppercase tracking-wide">
                                            {t('staff.rating.scoreLabel', 'РўРµРєСѓС‰РёР№ Р±Р°Р»Р»')}
                                        </span>
                                        <span className="text-xl font-semibold">{effectiveRatingScore.toFixed(1)}</span>
                                        <span className="text-[10px] opacity-70">/ 100</span>
                                    </div>
                                    {effectiveRatingScore <= 10 && (
                                        <span className="text-[10px] text-amber-700 dark:text-amber-300">
                                            {t('common.rating.lowRatingHint', 'РЅРёР·РєРёР№ СЂРµР№С‚РёРЅРі')}
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/60 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-50">
                                    <span className="text-xs font-medium uppercase tracking-wide">
                                        {t('common.rating.noRating', 'РќРµС‚ СЂРµР№С‚РёРЅРіР°')}
                                    </span>
                                </div>
                            )}
                            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 max-w-[220px]">
                                {getRatingAdvice(effectiveRatingScore, t)}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeBranches.length === 0 && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-md">
                    <div className="flex items-start gap-3">
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                            <p className="font-medium mb-1">{t('staff.detail.warning.noBranches.title', 'Р’ СЌС‚РѕРј Р±РёР·РЅРµСЃРµ РµС‰С‘ РЅРµС‚ Р°РєС‚РёРІРЅС‹С… С„РёР»РёР°Р»РѕРІ')}</p>
                            <p className="text-gray-600 dark:text-gray-400">{t('staff.detail.warning.noBranches.desc', 'РЎРѕР·РґР°Р№С‚Рµ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ С„РёР»РёР°Р», С‡С‚РѕР±С‹ РЅР°Р·РЅР°С‡РёС‚СЊ СЃРѕС‚СЂСѓРґРЅРёРєР°.')}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* РћСЃРЅРѕРІРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t('staff.detail.sections.mainInfo.title', 'РћСЃРЅРѕРІРЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('staff.detail.sections.mainInfo.desc', 'Р›РёС‡РЅС‹Рµ РґР°РЅРЅС‹Рµ Рё РєРѕРЅС‚Р°РєС‚С‹ СЃРѕС‚СЂСѓРґРЅРёРєР°')}</p>
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

            {/* РљРѕРјРїРµС‚РµРЅС†РёРё */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {t('staff.detail.sections.competencies.title', 'РљРѕРјРїРµС‚РµРЅС†РёРё')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('staff.detail.sections.competencies.desc', 'РЈСЃР»СѓРіРё, РєРѕС‚РѕСЂС‹Рµ РІС‹РїРѕР»РЅСЏРµС‚ СЌС‚РѕС‚ СЃРѕС‚СЂСѓРґРЅРёРє')}</p>
                </div>
                <StaffServicesEditor
                    staffId={String(staff.id)}
                    staffBranchId={String(staff.branch_id)}
                />
            </div>

            <StaffReviewsSection reviews={reviews} t={t} />

            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                    {t('staff.detail.transfer.note', 'Р’СЂРµРјРµРЅРЅС‹Рµ РїРµСЂРµРІРѕРґС‹ РјРµР¶РґСѓ С„РёР»РёР°Р»Р°РјРё Р·Р°РґР°СЋС‚СЃСЏ РІ СЂР°Р·РґРµР»Рµ')}{' '}
                    <Link href={`/dashboard/staff/${staff.id}/schedule`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                        {t('staff.detail.transfer.scheduleLink', 'В«Р Р°СЃРїРёСЃР°РЅРёРµВ»')}
                    </Link>.
                </p>
            </div>

            <DangerActions staffId={String(staff.id)} />
        </div>
    );
}
