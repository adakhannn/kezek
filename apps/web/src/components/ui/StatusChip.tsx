'use client';

import { Badge, type BadgeTone, type BadgeVariant } from './Badge';

type StatusChipProps = {
    status: string;
    label?: string;
    tone?: BadgeTone;
    className?: string;
};

const statusVariantMap: Record<string, BadgeVariant> = {
    active: 'success',
    ok: 'success',
    healthy: 'success',
    confirmed: 'success',
    paid: 'success',
    complete: 'success',
    completed: 'success',
    approved: 'success',
    pending: 'warning',
    hold: 'warning',
    warning: 'warning',
    queued: 'warning',
    draft: 'neutral',
    inactive: 'neutral',
    disabled: 'neutral',
    archived: 'neutral',
    info: 'info',
    processing: 'info',
    running: 'info',
    error: 'danger',
    failed: 'danger',
    canceled: 'danger',
    cancelled: 'danger',
    rejected: 'danger',
};

function formatFallbackLabel(status: string) {
    if (!status) return 'Unknown';
    return status
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function StatusChip({ status, label, tone = 'soft', className }: StatusChipProps) {
    const normalized = status.trim().toLowerCase();
    const variant = statusVariantMap[normalized] ?? 'neutral';

    return (
        <Badge variant={variant} tone={tone} className={className}>
            {label ?? formatFallbackLabel(status)}
        </Badge>
    );
}
