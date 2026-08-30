'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export type BranchRatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

type BranchRatingCardProps = {
    score?: number | null;
    weights: BranchRatingWeights;
};

const FACTORS = [
    { key: 'reviews', labelKey: 'branch.rating.factor.reviews', color: 'bg-emerald-400' },
    { key: 'productivity', labelKey: 'branch.rating.factor.productivity', color: 'bg-violet-400' },
    { key: 'loyalty', labelKey: 'branch.rating.factor.loyalty', color: 'bg-sky-400' },
    { key: 'discipline', labelKey: 'branch.rating.factor.discipline', color: 'bg-rose-400' },
] as const;

export default function BranchRatingCard({ score, weights }: BranchRatingCardProps) {
    const { t } = useLanguage();
    const effectiveScore = typeof score === 'number' ? score : null;

    const adviceKey = effectiveScore === null
        ? 'branch.rating.advice.noScore'
        : effectiveScore < 60
            ? 'branch.rating.advice.low'
            : effectiveScore < 80
                ? 'branch.rating.advice.medium'
                : 'branch.rating.advice.high';

    const scoreTone = effectiveScore === null
        ? 'border-amber-400/20 bg-amber-300/10 text-amber-100'
        : effectiveScore < 60
            ? 'border-rose-400/25 bg-rose-400/10 text-rose-100'
            : effectiveScore < 80
                ? 'border-amber-400/25 bg-amber-300/10 text-amber-100'
                : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';

    return (
        <section
            aria-labelledby="branch-rating-title"
            className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-br from-[#201713] via-[#17141a] to-[#111827] shadow-[0_20px_55px_-36px_rgba(245,158,11,0.65)]"
        >
            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="min-w-0">
                    <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-400/10 text-amber-300">
                            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                        </span>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300/80">
                                {t('branch.rating.eyebrow')}
                            </p>
                            <h2 id="branch-rating-title" className="mt-1 text-lg font-semibold text-white sm:text-xl">
                                {t('branch.rating.title')}
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                                {t('branch.rating.subtitle').replace('{days}', String(weights.windowDays))}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                            {t('branch.rating.period').replace('{days}', String(weights.windowDays))}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">
                            {t('branch.rating.refresh')}
                        </span>
                    </div>
                </div>

                <div className={`flex min-h-36 flex-col justify-center rounded-2xl border p-4 ${scoreTone}`}>
                    {effectiveScore === null ? (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">
                                {t('branch.rating.statusLabel')}
                            </p>
                            <p className="mt-2 text-lg font-semibold leading-snug text-white">
                                {t('branch.rating.noScore')}
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-current/70">
                                {t('branch.rating.scoreLabel')}
                            </p>
                            <div className="mt-2 flex items-end gap-2">
                                <span className="text-4xl font-bold leading-none text-white">{effectiveScore.toFixed(1)}</span>
                                <span className="pb-1 text-sm text-current/70">{t('branch.rating.outOf')}</span>
                            </div>
                        </>
                    )}
                    <p className="mt-3 text-xs leading-5 text-current/80">{t(adviceKey)}</p>
                </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-5 py-5 sm:px-6">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {t('branch.rating.factorsTitle')}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                    {FACTORS.map((factor) => {
                        const value = weights[factor.key];
                        const width = `${Math.max(0, Math.min(100, value))}%`;

                        return (
                            <div key={factor.key} className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                    <span className="font-medium text-slate-200">{t(factor.labelKey)}</span>
                                    <span className="shrink-0 font-semibold tabular-nums text-white">{value}%</span>
                                </div>
                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className={`h-full rounded-full ${factor.color}`} style={{ width }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
