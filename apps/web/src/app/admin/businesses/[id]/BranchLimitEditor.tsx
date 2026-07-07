'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';

export function BranchLimitEditor({ businessId, initialLimit, currentCount }: { businessId: string; initialLimit: number; currentCount: number }) {
    const router = useRouter();
    const [limit, setLimit] = useState(initialLimit);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось изменить лимит');
            router.refresh();
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Не удалось изменить лимит');
        } finally {
            setSaving(false);
        }
    }

    return (
        <Card variant="outlined" padding="md" className="space-y-3">
            <div>
                <h2 className="type-section-title">Лимит филиалов</h2>
                <p className="type-caption mt-1 text-gray-500">Сейчас создано: {currentCount}. Лимит нельзя установить ниже этого значения.</p>
            </div>
            {error ? <AlertBanner variant="danger" message={error} compact /> : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <Input label="Разрешено филиалов" type="number" min={Math.max(1, currentCount)} max={1000} value={String(limit)} onChange={(event) => setLimit(Number.parseInt(event.target.value || '1', 10))} />
                <Button type="button" onClick={save} isLoading={saving} disabled={limit === initialLimit || limit < currentCount || limit < 1 || limit > 1000}>Сохранить лимит</Button>
            </div>
        </Card>
    );
}
