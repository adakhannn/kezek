'use client';

import { formatInTimeZone } from 'date-fns-tz';
import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { AlertBanner } from '@/components/ui/AlertBanner';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { logError } from '@/lib/log';
import { TZ } from '@/lib/time';

type FieldChange = { field: string; old_value: number | null; new_value: number | null };
type AuditLogEntry = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    field_changes: FieldChange[];
    message: string | null;
};

const FIELD_LABELS: Record<string, string> = {
    percent_master: 'finance.auditLog.field.percentMaster',
    percent_salon: 'finance.auditLog.field.percentSalon',
    hourly_rate: 'finance.auditLog.field.hourlyRate',
};

function formatValue(value: number | null): string {
    if (value === null) return '—';
    return String(value);
}

export default function FinanceSettingsAuditLog({ staffId }: { staffId: string }) {
    const { t } = useLanguage();
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        const url = `/api/dashboard/staff/${staffId}/finance/audit-log`;
        fetch(url)
            .then((res) => {
                if (!res.ok) throw new Error(`HTTP_${res.status}`);
                return res.json();
            })
            .then((data) => {
                if (cancelled || !data?.ok) return;
                setEntries(data.data?.entries ?? []);
            })
            .catch((value) => {
                const message = value instanceof Error ? value.message : String(value);
                logError('FinanceSettingsAuditLog', 'Failed to load audit log', {
                    staffId,
                    url,
                    message,
                });
                if (!cancelled) setError(message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    return (
        <Card variant="default" padding="lg" className="mt-6">
            <SectionHeader
                title={t('finance.auditLog.title', 'Finance settings audit')}
                description={t(
                    'finance.auditLog.subtitle',
                    'Track who changed percentages and hourly guarantees, and when each change happened.',
                )}
                badge={<Badge variant="neutral">{entries.length}</Badge>}
            />

            {loading ? (
                <p className="type-caption mt-4 text-[var(--text-muted)]">{t('finance.loading', 'Loading...')}</p>
            ) : null}

            {error ? (
                <div className="mt-4">
                    <AlertBanner
                        variant="danger"
                        title={t('finance.auditLog.loadErrorTitle', 'Failed to load audit log')}
                        message={error}
                    />
                </div>
            ) : null}

            {!loading && !error && entries.length === 0 ? (
                <p className="type-caption mt-4 text-[var(--text-muted)]">
                    {t('finance.auditLog.empty', 'No finance setting changes yet')}
                </p>
            ) : null}

            {!loading && !error && entries.length > 0 ? (
                <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
                    <table className="min-w-full text-sm">
                        <thead className="bg-[var(--surface-elevated)]">
                            <tr className="text-left text-xs uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                                <th className="px-3 py-2">{t('finance.auditLog.when', 'When')}</th>
                                <th className="px-3 py-2">{t('finance.auditLog.who', 'Who')}</th>
                                <th className="px-3 py-2">{t('finance.auditLog.changes', 'Changes')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--surface-card)]">
                            {entries.map((entry) => (
                                <tr key={entry.id}>
                                    <td className="px-3 py-3 whitespace-nowrap text-[var(--text-secondary)]">
                                        {formatInTimeZone(new Date(entry.changed_at), TZ, 'dd.MM.yyyy HH:mm')}
                                    </td>
                                    <td className="px-3 py-3 text-[var(--text-primary)]">
                                        {entry.changed_by_name || t('finance.auditLog.unknownUser', 'Unknown user')}
                                    </td>
                                    <td className="px-3 py-3 text-[var(--text-secondary)]">
                                        {entry.field_changes.length > 0 ? (
                                            <ul className="space-y-1">
                                                {entry.field_changes.map((change, index) => (
                                                    <li key={`${entry.id}-${index}`} className="type-caption">
                                                        {t(FIELD_LABELS[change.field] ?? change.field, change.field)}: {formatValue(change.old_value)} →{' '}
                                                        {formatValue(change.new_value)}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            entry.message || '—'
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </Card>
    );
}
