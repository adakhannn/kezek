'use client';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';

type AdminPaginationProps = {
    page: number;
    totalPages: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    isBusy?: boolean;
};

export function AdminPagination({ page, totalPages, totalItems, onPageChange, isBusy = false }: AdminPaginationProps) {
    const { t } = useLanguage();
    if (totalPages <= 1) return null;

    return (
        <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="type-caption text-[var(--text-secondary)]">
                {t('admin.pagination.summary', 'Страница {page} из {totalPages} • Всего: {totalItems}')
                    .replace('{page}', String(page))
                    .replace('{totalPages}', String(totalPages))
                    .replace('{totalItems}', String(totalItems))}
            </p>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page - 1)}
                    disabled={isBusy || page <= 1}
                >
                    {t('admin.pagination.prev', 'Назад')}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange(page + 1)}
                    disabled={isBusy || page >= totalPages}
                >
                    {t('admin.pagination.next', 'Вперед')}
                </Button>
            </div>
        </div>
    );
}

