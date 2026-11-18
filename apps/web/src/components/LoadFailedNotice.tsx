'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';

/**
 * A failed load is an error with a retry - never an empty list, "no slots", "day off" or a blank
 * form that could overwrite real data on save (FE-08). Without onRetry the server data is
 * reloaded (router.refresh()).
 */
export function LoadFailedNotice({
    title,
    message,
    onRetry,
    page = false,
    className,
}: {
    title?: string;
    message?: string;
    onRetry?: () => void;
    /** Render as the whole page content (server pages that cannot show anything else). */
    page?: boolean;
    className?: string;
}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const retry = onRetry ?? (() => startTransition(() => router.refresh()));

    const banner = (
        <AlertBanner
            variant="danger"
            className={className}
            title={title ?? t('common.loadFailed.title', 'Не удалось загрузить данные')}
            message={message ?? t('common.loadFailed.message', 'Это ошибка загрузки, а не пустой список. Повторите попытку.')}
            action={
                <Button type="button" variant="secondary" size="sm" onClick={retry} disabled={pending}>
                    {t('common.loadFailed.retry', 'Повторить')}
                </Button>
            }
        />
    );

    return page ? <main className="mx-auto max-w-3xl p-6">{banner}</main> : banner;
}
