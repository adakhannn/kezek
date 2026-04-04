import type { DashboardRatingFactor } from './types';

type RatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

type DashboardRatingCardProps = {
    ratingWeights: RatingWeights | null;
    ratingScore: number | null;
    ratingConfigScope: 'biz' | 'global' | null;
    ratingFactors: DashboardRatingFactor[];
    title: string;
    subtitleTemplate: string;
    bizScopeLabel: string;
    globalScopeLabel: string;
    scoreLabel: string;
    noRatingLabel: string;
    lowRatingHint: string;
    overallHint: string;
    moreInfoLabel: string;
};

export function DashboardRatingCard({
    ratingWeights,
    ratingScore,
    ratingConfigScope,
    ratingFactors,
    title,
    subtitleTemplate,
    bizScopeLabel,
    globalScopeLabel,
    scoreLabel,
    noRatingLabel,
    lowRatingHint,
    overallHint,
    moreInfoLabel,
}: DashboardRatingCardProps) {
    if (!ratingWeights) {
        return null;
    }

    return (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                    <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </div>
                    <div>
                        <p className="type-label text-amber-900 dark:text-amber-100">{title}</p>
                        <p className="type-caption mt-0.5 text-amber-800/80 dark:text-amber-200/90">
                            {subtitleTemplate.replace('{days}', String(ratingWeights.windowDays))}
                        </p>
                        {ratingConfigScope ? (
                            <p className="type-caption mt-1 text-amber-800/80 dark:text-amber-200/90">
                                {ratingConfigScope === 'biz' ? bizScopeLabel : globalScopeLabel}
                            </p>
                        ) : null}
                        <div className="type-label mt-2 flex flex-wrap gap-2 text-amber-900/90 dark:text-amber-100">
                            {ratingFactors.map((factor) => (
                                <span
                                    key={factor.key}
                                    className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-1 dark:bg-amber-900/40"
                                >
                                    <span className={`h-1.5 w-1.5 rounded-full ${factor.dotClassName}`} />
                                    {factor.label}: {factor.value}%
                                </span>
                            ))}
                        </div>
                        <div className="mt-2">
                            <a
                                href="/docs/RATINGS_HOW_IT_WORKS"
                                target="_blank"
                                rel="noreferrer"
                                className="type-caption text-amber-800 underline hover:no-underline dark:text-amber-200"
                            >
                                {moreInfoLabel}
                            </a>
                        </div>
                    </div>
                </div>
                <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:flex-col sm:items-end sm:justify-center">
                    {ratingScore !== null && ratingScore !== undefined ? (
                        <div className="inline-flex flex-col items-end gap-0.5">
                            <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/80 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/50 dark:text-amber-50">
                                <span className="type-label uppercase tracking-[0.08em]">{scoreLabel}</span>
                                <span className="type-metric text-[1.75rem]">{ratingScore.toFixed(1)}</span>
                                <span className="type-caption opacity-70">/ 100</span>
                            </div>
                            {ratingScore <= 10 ? (
                                <span className="type-caption text-amber-700 dark:text-amber-300">
                                    {lowRatingHint}
                                </span>
                            ) : null}
                        </div>
                    ) : (
                        <div className="inline-flex items-baseline gap-1 rounded-xl bg-white/60 px-3 py-2 text-amber-900 shadow-sm dark:bg-amber-900/40 dark:text-amber-50">
                            <span className="type-label uppercase tracking-[0.08em]">{noRatingLabel}</span>
                        </div>
                    )}
                    <p className="type-caption max-w-[180px] text-amber-800/80 dark:text-amber-200/80">
                        {overallHint}
                    </p>
                </div>
            </div>
        </section>
    );
}
