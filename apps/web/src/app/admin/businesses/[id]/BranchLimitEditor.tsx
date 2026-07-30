'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function BranchLimitEditor({
    businessId,
    initialLimit,
    currentCount,
}: {
    businessId: string;
    initialLimit: number;
    currentCount: number;
}) {
    const { t } = useLanguage();
    const router = useRouter();
    const [limit, setLimit] = useState(initialLimit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const usedPercent = Math.min(100, Math.round((currentCount / Math.max(initialLimit, 1)) * 100));

    async function save() {
        setSaving(true);
        setError(null);
        try {
            const response = await fetch(`/admin/api/businesses/${businessId}/branch-limit`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ branch_limit: limit }),
            });
            const payload = (await response.json()) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) {
                throw new Error(payload.error || t('admin.businessDetail.branchLimit.error', 'Не удалось изменить лимит'));
            }
            router.refresh();
        } catch (saveError) {
            setError(
                saveError instanceof Error
                    ? saveError.message
                    : t('admin.businessDetail.branchLimit.error', 'Не удалось изменить лимит'),
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card variant="elevated" padding="lg" className="space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="type-section-title">
                        {t('admin.businessDetail.branchLimit.title', 'Лимит филиалов')}
                    </h2>
                    <p className="type-caption mt-1 text-[var(--text-muted)]">
                        {t('admin.businessDetail.branchLimit.description', 'Контролирует, сколько филиалов сможет создать владелец.')}
                    </p>
                </div>
                <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--accent-primary)]">
                    {currentCount} / {initialLimit}
                </span>
            </div>

            <div
                className="h-2 overflow-hidden rounded-full bg-[var(--surface-canvas)]"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={initialLimit}
                aria-valuenow={currentCount}
            >
                <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width]"
                    style={{ width: `${usedPercent}%` }}
                />
            </div>

            {error ? <AlertBanner variant="danger" message={error} compact /> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input
                    label={t('admin.businessDetail.branchLimit.allowed', 'Разрешено филиалов')}
                    type="number"
                    min={Math.max(1, currentCount)}
                    max={1000}
                    value={String(limit)}
                    containerClassName="sm:max-w-48"
                    onChange={(event) => setLimit(Number.parseInt(event.target.value || '1', 10))}
                />
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => void save()}
                    isLoading={saving}
                    disabled={limit === initialLimit || limit < currentCount || limit < 1 || limit > 1000}
                >
                    {t('admin.businessDetail.branchLimit.save', 'Обновить лимит')}
                </Button>
            </div>
        </Card>
    );
}
