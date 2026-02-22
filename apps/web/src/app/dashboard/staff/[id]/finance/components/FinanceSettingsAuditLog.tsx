'use client';

import { useEffect, useState } from 'react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { formatInTimeZone } from 'date-fns-tz';

type FieldChange = { field: string; old_value: number | null; new_value: number | null };
type AuditLogEntry = {
    id: string;
    changed_at: string;
    changed_by_user_id: string | null;
    changed_by_name: string | null;
    field_changes: FieldChange[];
    message: string | null;
};
import { ru, enUS } from 'date-fns/locale';
import { TZ } from '@/lib/time';

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
        fetch(`/api/dashboard/staff/${staffId}/finance/audit-log`)
            .then((res) => {
                if (!res.ok) throw new Error('Failed to load');
                return res.json();
            })
            .then((data) => {
                if (cancelled || !data?.ok) return;
                setEntries(data.data?.entries ?? []);
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : 'Error');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [staffId]);

    const locale = t('common.locale', 'ru') === 'ky' ? ru : t('common.locale', 'ru') === 'en' ? enUS : ru;
    const dateFmt = 'dd.MM.yyyy HH:mm';

    return (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6 mt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                {t('finance.auditLog.title', 'Журнал изменений финансовых настроек')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('finance.auditLog.subtitle', 'Кто и когда менял проценты и ставку за час')}
            </p>
            {loading && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('finance.loading', 'Загрузка...')}</p>
            )}
            {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                    {t('finance.auditLog.loadError', 'Не удалось загрузить журнал')}
                </p>
            )}
            {!loading && !error && entries.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('finance.auditLog.empty', 'Изменений пока не было')}
                </p>
            )}
            {!loading && !error && entries.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-800">
                                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                    {t('finance.auditLog.when', 'Когда')}
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                    {t('finance.auditLog.who', 'Кто')}
                                </th>
                                <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                                    {t('finance.auditLog.changes', 'Изменения')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry) => (
                                <tr key={entry.id} className="border-t border-gray-200 dark:border-gray-700">
                                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {formatInTimeZone(new Date(entry.changed_at), TZ, dateFmt, { locale })}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                        {entry.changed_by_name || t('finance.auditLog.unknownUser', 'Пользователь')}
                                    </td>
                                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                                        {entry.field_changes.length > 0 ? (
                                            <ul className="list-none space-y-0.5">
                                                {entry.field_changes.map((c, i) => (
                                                    <li key={i}>
                                                        {t(FIELD_LABELS[c.field] ?? c.field)}: {formatValue(c.old_value)} → {formatValue(c.new_value)}
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
            )}
        </div>
    );
}
