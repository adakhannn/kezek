'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';

type ApplicationStatusButtonProps = {
    id: string;
    status: string;
    label: string;
    disabled?: boolean;
};

export function ApplicationStatusButton({ id, status, label, disabled = false }: ApplicationStatusButtonProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function update() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/admin/api/business-applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.error || 'Не удалось обновить заявку');
            router.refresh();
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Не удалось обновить заявку');
        } finally {
            setLoading(false);
        }
    }

    return (
        <span className="inline-flex flex-col gap-1">
            <Button type="button" size="sm" variant="outline" onClick={update} isLoading={loading} disabled={disabled || loading}>
                {label}
            </Button>
            {error ? <span className="max-w-64 text-xs text-red-600">{error}</span> : null}
        </span>
    );
}
