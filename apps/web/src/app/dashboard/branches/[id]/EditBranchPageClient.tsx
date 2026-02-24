'use client';

import BranchForm from '../BranchForm';
import DeleteBranchButton from '../DeleteBranchButton';

import BranchPromotionsPanel from './BranchPromotionsPanel';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { BranchScheduleEditor } from '@/components/admin/branches/BranchScheduleEditor';


type BranchSchedule = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

export default function EditBranchPageClient({ 
    branch, 
    isSuperAdmin,
    initialSchedule = [],
    bizId,
    bizSlug,
    bizName,
    ratingScore,
    ratingWeights,
}: { 
    branch: { 
        id: string; 
        name: string; 
        address: string | null; 
        is_active: boolean; 
        lat: number | null; 
        lon: number | null; 
    }; 
    isSuperAdmin: boolean;
    initialSchedule?: BranchSchedule[];
    bizId: string;
    bizSlug: string;
    bizName?: string | null;
    ratingScore?: number | null;
    ratingWeights?: RatingWeights | null;
}) {
    const { t } = useLanguage();

    const effectiveRatingScore = typeof ratingScore === 'number' ? ratingScore : null;

    const getRatingAdvice = () => {
        if (effectiveRatingScore === null) {
            return t(
                'branch.rating.advice.noScore',
                'Рейтинг филиала рассчитывается на основе среднего рейтинга сотрудников. Рейтинг обновляется автоматически раз в сутки.',
            );
        }
        if (effectiveRatingScore < 60) {
            return t(
                'branch.rating.advice.low',
                'Нужно улучшить работу филиала: повысить качество сервиса сотрудников, увеличить количество клиентов и улучшить отзывы.',
            );
        }
        if (effectiveRatingScore < 80) {
            return t(
                'branch.rating.advice.medium',
                'Хороший уровень. Для роста рейтинга: поддерживать высокое качество работы сотрудников, увеличивать количество постоянных клиентов и улучшать отзывы.',
            );
        }
        return t(
            'branch.rating.advice.high',
            'Отличный рейтинг. Важно удерживать качество: поддерживать высокий уровень сервиса сотрудников и продолжать привлекать новых клиентов.',
        );
    };

    return (
        <main className="mx-auto max-w-3xl p-6 space-y-6">
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {t('branches.edit.title', 'Редактирование филиала')}
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                    {t('branches.edit.subtitle', 'Управление данными филиала')}
                </p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {t('branches.edit.bizContext', 'Бизнес')}: {bizName || t('branches.edit.bizDefaultName', 'Ваш бизнес в Kezek')}
                </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchForm
                    initial={{
                        id: String(branch.id),
                        name: String(branch.name),
                        address: (branch.address ?? null),
                        is_active: !!branch.is_active,
                        lat: branch.lat ?? null,
                        lon: branch.lon ?? null,
                    }}
                    apiBase="/api/branches"
                />
            </div>

            {/* Расписание филиала */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchScheduleEditor 
                    bizId={bizId}
                    branchId={String(branch.id)}
                    initialSchedule={initialSchedule}
                    apiBase="/api/branches"
                />
            </div>

            {/* Объяснение рейтинга филиала */}
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
                                    {t('branch.rating.title', 'Рейтинг филиала в Kezek')}
                                </p>
                                <p className="mt-0.5 text-[11px] text-amber-800/80 dark:text-amber-200/90">
                                    {t(
                                        'branch.rating.subtitle',
                                        'Рейтинг филиала = средний рейтинг сотрудников. Каждый рабочий день влияет на рейтинг за последние {days} дней.',
                                    ).replace('{days}', String(ratingWeights.windowDays))}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-amber-900/90 dark:text-amber-100">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        {t('dashboard.rating.factor.reviews', 'Отзывы')}: {ratingWeights.reviews}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        {t('dashboard.rating.factor.productivity', 'Количество клиентов')}:{' '}
                                        {ratingWeights.productivity}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                        {t('dashboard.rating.factor.loyalty', 'Возвращаемость клиентов')}:{' '}
                                        {ratingWeights.loyalty}%
                                    </span>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40">
                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                        {t('dashboard.rating.factor.discipline', 'Дисциплина (опоздания)')}:{' '}
                                        {ratingWeights.discipline}%
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:flex-col sm:items-end sm:justify-center">
                            {effectiveRatingScore !== null ? (
                                <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/80 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/50 dark:text-amber-50">
                                    <span className="text-xs font-medium uppercase tracking-wide">
                                        {t('branch.rating.scoreLabel', 'Текущий балл')}
                                    </span>
                                    <span className="text-xl font-semibold">{effectiveRatingScore.toFixed(1)}</span>
                                    <span className="text-[10px] opacity-70">/ 100</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/60 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-50">
                                    <span className="text-xs font-medium uppercase tracking-wide">
                                        {t('branch.rating.scoreLabelPending', 'Рейтинг считается')}
                                    </span>
                                </div>
                            )}
                            <p className="text-[11px] text-amber-800/80 dark:text-amber-200/80 max-w-[220px]">
                                {getRatingAdvice()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Акции филиала */}
            <BranchPromotionsPanel branchId={String(branch.id)} bizSlug={bizSlug} />

            {/* Временно скрыто */}
            {/* <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-800">
                <BranchAdminsPanel branchId={String(branch.id)} />
            </div> */}

            {/* Опасная зона - только для суперадмина */}
            {isSuperAdmin && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 shadow-lg space-y-4">
                    <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-bold text-red-800 dark:text-red-300">
                            {t('branches.danger.title', 'Опасная зона')}
                        </h3>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-400 leading-relaxed">
                        {t('branches.danger.desc', 'Удаление филиала невозможно, если к нему привязаны сотрудники, услуги или брони. Сначала необходимо удалить или переместить все связанные данные.')}
                    </p>
                    <DeleteBranchButton id={String(branch.id)} />
                </div>
            )}
        </main>
    );
}

