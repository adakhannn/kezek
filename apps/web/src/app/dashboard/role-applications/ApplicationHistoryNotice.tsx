'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

export function ApplicationHistoryNotice({ count, flags }: { count: number; flags: string[] }) {
    const { t } = useLanguage();
    const repeated = count > 0 || flags.includes('repeat_applicant') || flags.includes('high_submission_volume');
    const rejected = flags.includes('prior_rejection');
    const other = flags.some((flag) => !['repeat_applicant', 'high_submission_volume', 'prior_rejection'].includes(flag));
    if (!repeated && !rejected && !other) return null;

    return (
        <details className="rounded-xl border border-[var(--border-default)] bg-[var(--surface-emphasis)] p-3 text-sm text-[var(--text-secondary)]">
            <summary className="cursor-pointer rounded font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
                {repeated
                    ? t('dashboard.applicationHistory.repeat', 'Повторная заявка')
                    : t('dashboard.applicationHistory.title', 'Сведения о предыдущих подачах')}
                {count > 0 ? ` · ${t('dashboard.applicationHistory.count', 'Предыдущих заявок: {count}').replace('{count}', String(count))}` : ''}
            </summary>
            <div className="mt-3 space-y-2">
                {repeated && <p>{t('dashboard.applicationHistory.scope', 'Учтены предыдущие заявки на роль сотрудника во все бизнесы Kezek на момент этой подачи. Повторная подача сама по себе не означает нарушение.')}</p>}
                {rejected && <p>{t('dashboard.applicationHistory.rejected', 'Среди предыдущих заявок есть отклонённые. Это не определяет решение по текущей заявке.')}</p>}
                {other && <p>{t('dashboard.applicationHistory.other', 'Есть дополнительные системные отметки. Они сами по себе не являются причиной для отклонения.')}</p>}
            </div>
        </details>
    );
}
