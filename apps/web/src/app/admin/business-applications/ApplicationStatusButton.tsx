'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { Button } from '@/components/ui/Button';
import type { ButtonVariant } from '@/components/ui/buttonStyles';

type ApplicationStatusButtonProps = {
    id: string;
    status: string;
    label: string;
    disabled?: boolean;
    blockDays?: number;
    variant?: ButtonVariant;
};

export function ApplicationStatusButton({
    id,
    status,
    label,
    disabled = false,
    blockDays = 0,
    variant = 'outline',
}: ApplicationStatusButtonProps) {
    const { t } = useLanguage();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState(false);
    const [note, setNote] = useState('');

    async function update() {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/admin/api/business-applications/${id}/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ status, note, block_days: blockDays }),
            });
            const payload = await response.json().catch(() => ({})) as { ok?: boolean; error?: string };
            if (!response.ok || !payload.ok) throw new Error(payload.error || t('admin.businessApplications.error.update'));
            router.refresh();
            setEditing(false);
            setNote('');
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : t('admin.businessApplications.error.update'));
        } finally {
            setLoading(false);
        }
    }

    return (
        <span className="inline-flex flex-col gap-1">
            <Button
                type="button"
                size="sm"
                variant={variant}
                onClick={() => status === 'rejected' ? setEditing(true) : void update()}
                isLoading={loading}
                disabled={disabled || loading}
            >
                {label}
            </Button>
            {editing ? (
                <span className="flex min-w-72 flex-col gap-2 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] p-3">
                    <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={1000}
                        placeholder={t('admin.businessApplications.rejectionReason')}
                        className="min-h-20 rounded-md border border-[var(--border-default)] bg-transparent p-2 text-sm"
                    />
                    <span className="flex gap-2">
                        <Button type="button" size="sm" variant={blockDays > 0 ? 'danger' : 'primary'} onClick={update} isLoading={loading} disabled={!note.trim()}>
                            {t('admin.businessApplications.confirm')}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={loading}>
                            {t('admin.businessApplications.cancel')}
                        </Button>
                    </span>
                </span>
            ) : null}
            {error ? <span className="max-w-64 text-xs text-red-600">{error}</span> : null}
        </span>
    );
}
