'use client';

import { useState } from 'react';

type DebugData = {
    client?: {
        id: string;
        email?: string;
        phone?: string;
        name?: string;
    };
    branch?: {
        id: string;
        name: string;
        biz_id: string;
    };
    biz?: {
        id: string;
        name: string;
        slug: string;
    };
    promotionUsage: Array<{
        id: string;
        promotion_id: string;
        promotion_type: string;
        booking_id: string | null;
        used_at: string;
        usage_data: unknown;
        promotion?: {
            title_ru: string;
            promotion_type: string;
            params: unknown;
        };
        booking?: {
            id: string;
            start_at: string;
            end_at: string;
            status: string;
            service_id: string;
            promotion_applied: unknown;
        };
    }>;
    referrals: Array<{
        id: string;
        referrer_id: string;
        referred_id: string;
        referrer_booking_id: string | null;
        referred_booking_id: string | null;
        referrer_bonus_used: boolean;
        created_at: string;
        referrer?: {
            email?: string;
            phone?: string;
        };
        referred?: {
            email?: string;
            phone?: string;
        };
    }>;
    bookings: Array<{
        id: string;
        start_at: string;
        end_at: string;
        status: string;
        promotion_applied: unknown;
        service?: {
            name_ru: string;
        };
    }>;
    activePromotions: Array<{
        id: string;
        title_ru: string;
        promotion_type: string;
        params: unknown;
        is_active: boolean;
    }>;
    anomalies: Array<{
        type: string;
        message: string;
        severity: 'warning' | 'error';
        data?: unknown;
    }>;
};

export function PromotionsDebugClient() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<DebugData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [clientId, setClientId] = useState('');
    const [branchId, setBranchId] = useState('');
    const [bizId, setBizId] = useState('');

    const loadData = async () => {
        if (!clientId && !branchId && !bizId) {
            setError('Укажите clientId, branchId или bizId');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (clientId) params.set('clientId', clientId);
            if (branchId) params.set('branchId', branchId);
            if (bizId) params.set('bizId', bizId);

            const res = await fetch(`/api/admin/promotions/debug?${params.toString()}`);
            const json = await res.json();

            if (!json.ok) {
                throw new Error(json.error || 'Failed to load data');
            }

            setData(json.data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
                Отладка промо-акций
            </h1>

            {/* Поиск */}
            <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Client ID (UUID)
                        </label>
                        <input
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="00000000-0000-0000-0000-000000000000"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Branch ID (UUID)
                        </label>
                        <input
                            type="text"
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            placeholder="00000000-0000-0000-0000-000000000000"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Business ID (UUID)
                        </label>
                        <input
                            type="text"
                            value={bizId}
                            onChange={(e) => setBizId(e.target.value)}
                            placeholder="00000000-0000-0000-0000-000000000000"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                    </div>
                </div>
                <button
                    onClick={loadData}
                    disabled={loading}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                    {loading ? 'Загрузка...' : 'Загрузить данные'}
                </button>
            </div>

            {error && (
                <div className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200">
                    {error}
                </div>
            )}

            {data && (
                <div className="space-y-6">
                    {/* Информация о клиенте/филиале/бизнесе */}
                    {(data.client || data.branch || data.biz) && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Информация
                            </h2>
                            {data.client && (
                                <div className="mb-2">
                                    <strong>Клиент:</strong> {data.client.name || data.client.email || data.client.phone || 'N/A'} (
                                    {data.client.id})
                                </div>
                            )}
                            {data.branch && (
                                <div className="mb-2">
                                    <strong>Филиал:</strong> {data.branch.name} ({data.branch.id})
                                </div>
                            )}
                            {data.biz && (
                                <div>
                                    <strong>Бизнес:</strong> {data.biz.name} ({data.biz.slug})
                                </div>
                            )}
                        </div>
                    )}

                    {/* Аномалии */}
                    {data.anomalies.length > 0 && (
                        <div className="rounded-lg border border-red-300 bg-red-50 p-4 shadow-sm dark:border-red-700 dark:bg-red-950/40">
                            <h2 className="mb-3 text-lg font-semibold text-red-900 dark:text-red-100">
                                Обнаружены аномалии ({data.anomalies.length})
                            </h2>
                            <div className="space-y-2">
                                {data.anomalies.map((anomaly, idx) => (
                                    <div
                                        key={idx}
                                        className={`rounded border p-2 text-sm ${
                                            anomaly.severity === 'error'
                                                ? 'border-red-500 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/30 dark:text-red-200'
                                                : 'border-amber-500 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200'
                                        }`}
                                    >
                                        <div className="font-medium">
                                            [{anomaly.severity === 'error' ? 'ОШИБКА' : 'ПРЕДУПРЕЖДЕНИЕ'}] {anomaly.type}
                                        </div>
                                        <div className="mt-1">{anomaly.message}</div>
                                        {anomaly.data != null && (
                                            <pre className="mt-2 overflow-auto text-xs">
                                                {JSON.stringify(anomaly.data as Record<string, unknown>, null, 2)}
                                            </pre>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* История использования акций */}
                    {data.promotionUsage.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                История использования акций ({data.promotionUsage.length})
                            </h2>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                                    <thead className="bg-gray-50 dark:bg-gray-800">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Дата
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Акция
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Тип
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Бронирование
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                                                Данные
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                                        {data.promotionUsage.map((usage) => (
                                            <tr key={usage.id}>
                                                <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                                                    {new Date(usage.used_at).toLocaleString('ru-RU')}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                                                    {usage.promotion?.title_ru || usage.promotion_id}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                                                    {usage.promotion_type}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                                                    {usage.booking_id ? (
                                                        <span>
                                                            {usage.booking_id.substring(0, 8)}...{' '}
                                                            {usage.booking?.status && (
                                                                <span
                                                                    className={`ml-1 rounded px-1 ${
                                                                        usage.booking.status === 'paid'
                                                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                                                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                                                    }`}
                                                                >
                                                                    {usage.booking.status}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-xs text-gray-900 dark:text-gray-100">
                                                    <pre className="max-w-xs overflow-auto text-xs">
                                                        {JSON.stringify(usage.usage_data, null, 2)}
                                                    </pre>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Реферальные связи */}
                    {data.referrals.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Реферальные связи ({data.referrals.length})
                            </h2>
                            <div className="space-y-2">
                                {data.referrals.map((ref) => (
                                    <div
                                        key={ref.id}
                                        className="rounded border border-gray-200 p-3 text-sm dark:border-gray-800"
                                    >
                                        <div>
                                            <strong>Реферер:</strong> {ref.referrer?.email || ref.referrer?.phone || ref.referrer_id}
                                        </div>
                                        <div>
                                            <strong>Реферал:</strong> {ref.referred?.email || ref.referred?.phone || ref.referred_id}
                                        </div>
                                        <div>
                                            <strong>Бонус использован:</strong>{' '}
                                            {ref.referrer_bonus_used ? (
                                                <span className="text-green-600 dark:text-green-400">Да</span>
                                            ) : (
                                                <span className="text-amber-600 dark:text-amber-400">Нет</span>
                                            )}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                            Создано: {new Date(ref.created_at).toLocaleString('ru-RU')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Бронирования с акциями */}
                    {data.bookings.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Бронирования с применёнными акциями ({data.bookings.length})
                            </h2>
                            <div className="space-y-2">
                                {data.bookings.map((booking) => (
                                    <div
                                        key={booking.id}
                                        className="rounded border border-gray-200 p-3 text-sm dark:border-gray-800"
                                    >
                                        <div>
                                            <strong>ID:</strong> {booking.id.substring(0, 8)}...
                                        </div>
                                        <div>
                                            <strong>Услуга:</strong> {booking.service?.name_ru || 'N/A'}
                                        </div>
                                        <div>
                                            <strong>Дата:</strong> {new Date(booking.start_at).toLocaleString('ru-RU')}
                                        </div>
                                        <div>
                                            <strong>Статус:</strong>{' '}
                                            <span
                                                className={`rounded px-1 ${
                                                    booking.status === 'paid'
                                                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                                                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                                                }`}
                                            >
                                                {booking.status}
                                            </span>
                                        </div>
                                        <div className="mt-2">
                                            <strong>Применённая акция:</strong>
                                            <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
                                                {JSON.stringify(booking.promotion_applied as Record<string, unknown>, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Активные акции */}
                    {data.activePromotions.length > 0 && (
                        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
                                Активные акции филиала ({data.activePromotions.length})
                            </h2>
                            <div className="space-y-2">
                                {data.activePromotions.map((promo) => (
                                    <div
                                        key={promo.id}
                                        className="rounded border border-gray-200 p-3 text-sm dark:border-gray-800"
                                    >
                                        <div>
                                            <strong>{promo.title_ru}</strong> ({promo.promotion_type})
                                        </div>
                                        <div className="mt-1">
                                            <strong>Активна:</strong>{' '}
                                            {promo.is_active ? (
                                                <span className="text-green-600 dark:text-green-400">Да</span>
                                            ) : (
                                                <span className="text-gray-400">Нет</span>
                                            )}
                                        </div>
                                        <div className="mt-1">
                                            <strong>Параметры:</strong>
                                            <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-800">
                                                {JSON.stringify(promo.params, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {data.promotionUsage.length === 0 &&
                        data.referrals.length === 0 &&
                        data.bookings.length === 0 &&
                        data.activePromotions.length === 0 && (
                            <div className="rounded-lg border border-gray-200 bg-white p-4 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                                Данные не найдены
                            </div>
                        )}
                </div>
            )}
        </div>
    );
}

