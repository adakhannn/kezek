'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

type PromotionsSummary = {
  promoBookings: number;
  promoRevenue: number;
  totalRevenue: number;
};

type PromotionsByType = {
  promotionType: string;
  bookings: number;
  revenue: number;
  discountGiven: number;
};

type PromotionsResponse = {
  ok: boolean;
  data?: {
    summary: PromotionsSummary;
    byType?: PromotionsByType[];
    period: { startDate: string; endDate: string };
  };
  error?: string;
};

type PeriodPreset = '7' | '30' | '90' | 'custom';
type SortKey = 'revenue' | 'bookings' | 'discount' | 'type';
type SortDir = 'asc' | 'desc';

type BranchOption = { id: string; name: string };

function formatNumber(n: number) {
  return n.toLocaleString('ru-RU');
}

function formatCurrencyKGS(n: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KGS',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminAnalyticsPromotionsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [promoTypeFilter, setPromoTypeFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [data, setData] = useState<PromotionsResponse['data'] | null>(null);

  useEffect(() => {
    const today = new Date();
    const endDefault = today.toISOString().slice(0, 10);
    const startDefault = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const persisted = loadPersistedAnalyticsFilters();

    setStartDate(persisted.startDate ?? startDefault);
    setEndDate(persisted.endDate ?? endDefault);
    if (persisted.branchId) {
      setBranchId(persisted.branchId);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadBranches() {
      try {
        const resp = await fetch('/api/admin/branches/list', { cache: 'no-store' });
        if (!resp.ok) return;
        const json = await resp.json();
        if (!json?.ok || !Array.isArray(json.data)) return;
        if (!ignore) {
          setBranches(json.data as BranchOption[]);
        }
      } catch {
        // best-effort
      }
    }
    loadBranches();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let ignore = false;

    async function loadPromotions() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        params.set('groupBy', 'type');
        if (branchId !== 'all') {
          params.set('branchId', branchId);
        }

        const resp = await fetch(`/admin/api/analytics/promotions?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const json: PromotionsResponse = await resp.json();
        if (!json.ok || !json.data) {
          throw new Error(json.error || 'Не удалось загрузить аналитику промо');
        }
        if (!ignore) {
          setData(json.data);
          setPromoTypeFilter('all');
        }
      } catch (e) {
        if (!ignore) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadPromotions();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate, branchId]);

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === 'custom') return;
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
  };

  const allTypes = useMemo(() => {
    if (!data?.byType) return [];
    return data.byType.map((t) => t.promotionType).sort();
  }, [data]);

  const filteredAndSorted = useMemo(() => {
    if (!data?.byType) return [];
    let arr = data.byType;
    if (promoTypeFilter !== 'all') {
      arr = arr.filter((t) => t.promotionType === promoTypeFilter);
    }
    const sorted = [...arr].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case 'bookings':
          av = a.bookings;
          bv = b.bookings;
          break;
        case 'discount':
          av = a.discountGiven;
          bv = b.discountGiven;
          break;
        case 'type':
          av = a.promotionType;
          bv = b.promotionType;
          break;
        case 'revenue':
        default:
          av = a.revenue;
          bv = b.revenue;
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const na = Number(av);
      const nb = Number(bv);
      return sortDir === 'asc' ? na - nb : nb - na;
    });
    return sorted;
  }, [data, promoTypeFilter, sortKey, sortDir]);

  const handleSortChange = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'type' ? 'asc' : 'desc');
    }
  };

  useEffect(() => {
    if (!startDate || !endDate) return;
    persistAnalyticsFilters({
      startDate,
      endDate,
      branchId,
    });
  }, [startDate, endDate, branchId]);

  if (loading && !data) {
    return (
      <div className="px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Загружаем аналитику промо...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <div className="max-w-xl mx-auto bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">Ошибка загрузки промо</h1>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setStartDate((s) => s);
            }}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <span>Попробовать снова</span>
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { summary, period } = data;
  const promoShare =
    summary.totalRevenue > 0 && summary.promoRevenue > 0
      ? Math.round(((summary.promoRevenue / summary.totalRevenue) * 100 + Number.EPSILON) * 100) / 100
      : 0;
  const nonPromoRevenue = summary.totalRevenue - summary.promoRevenue;

  return (
    <div className="space-y-6 py-6">
      {/* Фильтры */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Фильтры</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Период, филиал и тип промо задают срез для аналитики промо‑акций.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Период данных: {period.startDate} — {period.endDate}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Период */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Период
            </p>
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
              {(['7', '30', '90', 'custom'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    periodPreset === p
                      ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  {p === '7' && '7 дней'}
                  {p === '30' && '30 дней'}
                  {p === '90' && '90 дней'}
                  {p === 'custom' && 'Кастомный'}
                </button>
              ))}
            </div>
          </div>

          {/* Дата начала */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Дата начала
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Дата окончания */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Дата окончания
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset('custom');
              }}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Филиал */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Филиал
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Все филиалы</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Тип промо (клиентский фильтр по byType) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Тип промо
            </label>
            <select
              value={promoTypeFilter}
              onChange={(e) => setPromoTypeFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Все типы</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* KPI по промо */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Промо‑бронирования
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.promoBookings)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Выручка с промо
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrencyKGS(summary.promoRevenue)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Выручка без промо (оценка)
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrencyKGS(nonPromoRevenue)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Доля промо‑выручки
          </p>
          <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {promoShare.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Из общей выручки {formatCurrencyKGS(summary.totalRevenue)}
          </p>
        </div>
      </section>

      {/* Таблица по типам промо */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Вклад отдельных типов промо
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Сравните эффективность разных типов промо по выручке, количеству и сумме скидки.
            </p>
          </div>
        </div>

        {filteredAndSorted.length === 0 ? (
          <div className="h-32 flex items-center justify-center text-xs text-gray-400">
            Нет данных по промо‑акциям за выбранный период / фильтры.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th
                    className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer"
                    onClick={() => handleSortChange('type')}
                  >
                    Тип промо
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer"
                    onClick={() => handleSortChange('bookings')}
                  >
                    Бронирований
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer"
                    onClick={() => handleSortChange('revenue')}
                  >
                    Выручка с промо
                  </th>
                  <th
                    className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer"
                    onClick={() => handleSortChange('discount')}
                  >
                    Сумма скидок
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Доля в промо‑выручке
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredAndSorted.map((row) => {
                  const share =
                    summary.promoRevenue > 0
                      ? Math.round(((row.revenue / summary.promoRevenue) * 100 + Number.EPSILON) * 100) / 100
                      : 0;
                  return (
                    <tr key={row.promotionType} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
                      <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{row.promotionType}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {formatNumber(row.bookings)}
                      </td>
                      <td className="px-3 py-2 text-right text-emerald-700 dark:text-emerald-300 tabular-nums">
                        {formatCurrencyKGS(row.revenue)}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-700 dark:text-rose-300 tabular-nums">
                        {formatCurrencyKGS(row.discountGiven)}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                        {share.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
