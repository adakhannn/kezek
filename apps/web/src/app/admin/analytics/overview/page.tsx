'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

type OverviewSummary = {
  period: {
    startDate: string;
    endDate: string;
  };
  bookings: {
    created: number;
    confirmedOrPaid: number;
  };
  funnel: {
    homeViews: number;
    businessPageViews: number;
    bookingFlowStarts: number;
    conversionHomeToBooking: number;
  };
  revenue: {
    total: number;
    promoBookings: number;
    promoRevenue: number;
  };
};

type OverviewByDayPoint = {
  date: string;
  homeViews: number;
  businessPageViews: number;
  bookingFlowStarts: number;
  bookingsCreated: number;
  bookingsConfirmedOrPaid: number;
  promoBookings: number;
  promoRevenue: number;
  totalRevenue: number;
};

type OverviewResponse = {
  ok: boolean;
  data?: {
    summary: OverviewSummary;
    byDay: OverviewByDayPoint[];
  };
  error?: string;
};

type PeriodPreset = '7' | '30' | '90' | 'custom';

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

export default function AdminAnalyticsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [data, setData] = useState<OverviewResponse['data'] | null>(null);

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
          setBranches(json.data as Array<{ id: string; name: string }>);
        }
      } catch {
        // best-effort: игнорируем ошибку, фильтр по филиалу опционален
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

    async function loadOverview() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        if (branchId && branchId !== 'all') {
          params.set('branchIds', branchId);
        }

        const resp = await fetch(`/admin/api/analytics/overview?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const json: OverviewResponse = await resp.json();
        if (!json.ok || !json.data) {
          throw new Error(json.error || 'Не удалось загрузить данные обзора');
        }
        if (!ignore) {
          setData(json.data);
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

    loadOverview();
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

  const trendChartData = useMemo(() => {
    if (!data) return null;
    const series = {
      bookings: data.byDay.map((p) => ({ x: p.date, y: p.bookingsConfirmedOrPaid })),
      revenue: data.byDay.map((p) => ({ x: p.date, y: p.totalRevenue })),
      promoShare: data.byDay.map((p) => {
        const total = p.bookingsConfirmedOrPaid || 0;
        const promo = p.promoBookings || 0;
        const share = total > 0 ? Math.round(((promo / total) * 100 + Number.EPSILON) * 100) / 100 : 0;
        return { x: p.date, y: share };
      }),
    };
    return series;
  }, [data]);

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
            <span className="text-sm text-gray-600 dark:text-gray-300">Загружаем обзор аналитики...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <div className="max-w-xl mx-auto bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">Ошибка загрузки обзора</h1>
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              // триггерим useEffect обновлением дат
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

  const { summary, byDay } = data;
  const promoShare =
    summary.revenue.total > 0 && summary.revenue.promoRevenue > 0
      ? Math.round(((summary.revenue.promoRevenue / summary.revenue.total) * 100 + Number.EPSILON) * 100) / 100
      : 0;

  return (
    <div className="space-y-6 py-6">
      {/* Фильтры */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Фильтры</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Период и филиал задают срез для всех метрик и трендов.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Пресеты периода */}
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

          {/* Даты */}
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
        </div>
      </section>

      {/* KPI */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Брони (успешные)
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.bookings.confirmedOrPaid)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Из {formatNumber(summary.bookings.created)} созданных за период
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Конверсия home → бронь
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {summary.funnel.conversionHomeToBooking.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(summary.funnel.homeViews)} просмотров главной,
            {' '}
            {formatNumber(summary.bookings.confirmedOrPaid)} успешных броней
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Выручка (оценка)
          </p>
          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrencyKGS(summary.revenue.total)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Включая промо‑выручку {formatCurrencyKGS(summary.revenue.promoRevenue)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            Доля промо‑бронирований
          </p>
          <p className="mt-2 text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {promoShare.toFixed(2)}%
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatNumber(summary.revenue.promoBookings)} броней с промо за период
          </p>
        </div>
      </section>

      {/* Тренды */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Тренд по успешным бронированиям
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Распределение подтверждённых/оплаченных броней по дням.
              </p>
            </div>
          </div>

          <div className="h-56">
            {trendChartData && trendChartData.bookings.length > 0 ? (
              <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
                {trendChartData.bookings.map((p) => (
                  <li key={p.x} className="flex items-center justify-between">
                    <span className="tabular-nums">{p.x}</span>
                    <span className="font-semibold">{formatNumber(p.y)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Нет данных за выбранный период
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Тренд по выручке
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Оценочная выручка по дням (с учётом промо).
              </p>
            </div>
          </div>

          <div className="h-56">
            {trendChartData && trendChartData.revenue.length > 0 ? (
              <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
                {trendChartData.revenue.map((p) => (
                  <li key={p.x} className="flex items-center justify-between">
                    <span className="tabular-nums">{p.x}</span>
                    <span className="font-semibold">{formatCurrencyKGS(p.y)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-gray-400">
                Нет данных за выбранный период
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Доля промо по дням */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Доля промо‑бронирований по дням
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Какую часть успешных броней составляют промо‑акции.
            </p>
          </div>
        </div>

        <div className="h-64">
          {trendChartData && trendChartData.promoShare.length > 0 ? (
            <ul className="h-full overflow-y-auto space-y-1 text-xs text-gray-600 dark:text-gray-300">
              {trendChartData.promoShare.map((p) => (
                <li key={p.x} className="flex items-center justify-between">
                  <span className="tabular-nums">{p.x}</span>
                  <span className="font-semibold">{p.y.toFixed(2)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-400">
              Нет данных за выбранный период
            </div>
          )}
        </div>

        {/* Сырые данные (для отладки и сверки) */}
        <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer select-none">
            Сырые данные по дням (для тех. сверки)
          </summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="min-w-full text-[11px]">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-gray-500 dark:text-gray-400">Дата</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Home</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Biz</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Starts</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Created</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">Confirmed</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">PromoB</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">PromoRev</th>
                  <th className="px-2 py-1 text-right font-medium text-gray-500 dark:text-gray-400">TotalRev</th>
                </tr>
              </thead>
              <tbody>
                {byDay.map((p) => (
                  <tr key={p.date} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1 text-left text-gray-900 dark:text-gray-100">{p.date}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.homeViews}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.businessPageViews}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.bookingFlowStarts}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.bookingsCreated}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.bookingsConfirmedOrPaid}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.promoBookings}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.promoRevenue}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{p.totalRevenue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </div>
  );
}
