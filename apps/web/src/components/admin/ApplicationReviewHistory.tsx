import type { I18nKey } from '@/app/_components/i18n/LanguageProvider';

type Translate = (key: I18nKey) => string;

/** Informational submission history, never an automatic moderation decision. */
export function ApplicationReviewHistory({ count, flags, t }: { count: number; flags: string[]; t: Translate }) {
    const repeated = count > 0 || flags.includes('repeat_applicant') || flags.includes('high_submission_volume');
    const rejected = flags.includes('prior_rejection');
    const other = flags.some(flag => !['repeat_applicant', 'high_submission_volume', 'prior_rejection'].includes(flag));
    if (!repeated && !rejected && !other) return null;
    return <details className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
        <summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
            {t(repeated ? 'admin.applicationHistory.repeat' : 'admin.applicationHistory.title')}
            {count > 0 ? ` · ${t('admin.applicationHistory.count').replace('{count}', String(count))}` : ''}
        </summary>
        <div className="mt-3 space-y-2">
            {repeated && <p>{t('admin.applicationHistory.repeatNotice')}</p>}
            {rejected && <p>{t('admin.applicationHistory.rejected')}</p>}
            {other && <p>{t('admin.applicationHistory.other')}</p>}
        </div>
    </details>;
}

const stateKeys = {
    pending: 'admin.applicationHistory.status.pending',
    approved: 'admin.applicationHistory.status.approved',
    rejected: 'admin.applicationHistory.status.rejected',
    cancelled: 'admin.applicationHistory.status.cancelled',
} as const;

export function ApplicationReviewStatus({ status, t }: { status: keyof typeof stateKeys; t: Translate }) {
    return <span className="rounded-full bg-[var(--surface-emphasis)] px-3 py-1 text-xs font-medium">{t(stateKeys[status])}</span>;
}
