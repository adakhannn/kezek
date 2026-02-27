'use client';

import { useEffect, useMemo, useState } from 'react';

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

type BranchOption = { id: string; name: string };

type LoadPoint = {
  date: string;
  hour: number;
  bookingsCount: number;
  promoBookingsCount: number;
};

type LoadResponse = {
  ok: boolean;
  data?: {
    period: { startDate: string; endDate: string };
    points: LoadPoint[];
  };
  error?: string;
};

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

export default function DashboardAnalyticsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [data, setData] = useState<OverviewResponse['data'] | null>(null);
  const [loadData, setLoadData] = useState<LoadResponse['data'] | null>(null);

  useEffect(() => {
    const today = new Date();
    const endDefault = today.toISOString().slice(0, 10);
    const startDefault = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setStartDate(startDefault);
    setEndDate(endDefault);
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadBranches() {
      try {
        const resp = await fetch('/api/dashboard/branches/list', { cache: 'no-store' });
        if (!resp.ok) return;
        const json = (await resp.json()) as { ok: boolean; data?: BranchOption[] };
        if (!json.ok || !Array.isArray(json.data)) return;
        if (!ignore) {
          setBranches(json.data);
        }
      } catch {
        // best-effort: фильтр по филиалу опционален
      }
    }
    void loadBranches();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let ignore = false;

    async function loadAll() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);

        const [overviewResp, loadResp] = await Promise.all([
          fetch(`/api/dashboard/analytics/overview?${params.toString()}`, {
            cache: 'no-store',
          }),
          fetch(
            `/api/dashboard/analytics/load?${new URLSearchParams({
              startDate,
              endDate,
              ...(branchId !== 'all' ? { branchId } : {}),
            }).toString()}`,
            { cache: 'no-store' },
          ),
        ]);

        if (!overviewResp.ok) {
          throw new Error(`Overview HTTP ${overviewResp.status}`);
        }
        const overviewJson: OverviewResponse = await overviewResp.json();
        if (!overviewJson.ok || !overviewJson.data) {
          throw new Error(overviewJson.error || 'Не удалось загрузить данные обзора');
        }

        if (!loadResp.ok) {
          throw new Error(`Load HTTP ${loadResp.status}`);
        }
        const loadJson: LoadResponse = await loadResp.json();
        if (!loadJson.ok || !loadJson.data) {
          throw new Error(loadJson.error || 'Не удалось загрузить данные по загрузке');
        }

        if (!ignore) {
          setData(overviewJson.data);
          setLoadData(loadJson.data);
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

    void loadAll();
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
    };
    return series;
  }, [data]);

  if (loading && !data) {
    return (
      <div className="px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Загружаем аналитику по бизнесу...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <div className="max-w-xl mx-auto bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">Ошибка загрузки аналитики</h1>
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

  const { summary, byDay } = data;
  const promoShare =
    summary.revenue.total > 0 && summary.revenue.promoRevenue > 0
      ? Math.round(((summary.revenue.promoRevenue / summary.revenue.total) * 100 + Number.EPSILON) * 100) / 100
      : 0;

  return (
    <div className="space-y-6 py-6 px-4 sm:px-6 lg:px-8">
      {/* Заголовок */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Аналитика бизнеса</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Краткий обзор воронки бронирований и выручки по вашему бизнесу.
        </p>
      </header>

      {/* Фильтры */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Период</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Выберите период, за который нужно посмотреть конверсию и выручку.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {/* Пресеты периода */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Быстрый выбор</p>
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
              {(['7', '30', '90', 'custom'] as PeriodPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePresetChange(p)}
                  className={`px-3 py-1.5 rounded-full transition-colors ${
                    periodPreset === p
                      ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                  }`}
                >
                  {p === '7' ? '7 дней' : p === '30' ? '30 дней' : p === '90' ? '90 дней' : 'Свой период'}
                </button>
              ))}
            </div>
          </div>

          {/* Даты */}
          <div className="space-y-2">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Филиал</p>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Все филиалы</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Фильтр по филиалу влияет на блок «Загрузка по часам».
            </p>
          </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Начало</p>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setPeriodPreset('custom');
                setStartDate(e.target.value);
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">Окончание</p>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setPeriodPreset('custom');
                setEndDate(e.target.value);
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>
      </section>

      {/* KPI */}
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Создано бронирований
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.bookings.created)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Подтверждено/оплачено
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.bookings.confirmedOrPaid)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Конверсия из выдачи в бронь
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {summary.funnel.conversionHomeToBooking.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Выручка за период
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrencyKGS(summary.revenue.total)}
          </p>
        </div>
      </section>

      {/* Тренды и загрузка */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Динамика бронирований</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Как менялось количество подтверждённых бронирований по дням.
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
            {byDay.map((p) => (
              <div key={p.date} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{p.date}</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatNumber(p.bookingsConfirmedOrPaid)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Выручка и доля промо</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Сравнение общей выручки и доли выручки по промо‑акциям.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Выручка по промо</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {formatCurrencyKGS(summary.revenue.promoRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-300">Доля промо в выручке</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{promoShare.toFixed(2)}%</span>
            </div>
          </div>

          {trendChartData && (
            <div className="mt-4 space-y-2 max-h-64 overflow-y-auto pr-2">
              {trendChartData.revenue.map((p) => (
                <div key={p.x} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">{p.x}</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrencyKGS(p.y)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {loadData && (
        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Загрузка по часам</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Простая heatmap по часам для оценки «часов пик» по выбранному периоду и филиалу.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-separate border-spacing-y-1">
              <thead>
                <tr>
                  <th className="text-left text-gray-500 dark:text-gray-400 px-2 py-1">Час</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">Брони</th>
                  <th className="text-right text-gray-500 dark:text-gray-400 px-2 py-1">Промо</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 24 }).map((_, hour) => {
                  const total = loadData.points
                    .filter((p) => p.hour === hour)
                    .reduce((acc, p) => acc + p.bookingsCount, 0);
                  const promo = loadData.points
                    .filter((p) => p.hour === hour)
                    .reduce((acc, p) => acc + p.promoBookingsCount, 0);
                  const intensity =
                    total === 0 ? 0 : Math.min(1, total / Math.max(...loadData.points.map((p) => p.bookingsCount || 1)));
                  const bg =
                    intensity === 0
                      ? 'bg-gray-50 dark:bg-gray-900'
                      : intensity < 0.33
                        ? 'bg-emerald-50 dark:bg-emerald-900/30'
                        : intensity < 0.66
                          ? 'bg-emerald-100 dark:bg-emer��ld-800/50'
                          : 'bg-emerald-200 dark:bg-emerald-700/70';
                  return (
                    <tr key={hour} className={`${bg} rounded-xl`}>
                      <td className="px-2 py-1 text-gray-700 dark:text-gray-200">{hour}:00</td>
                      <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                        {total ? formatNumber(total) : '—'}
                      </td>
                      <td className="px-2 py-1 text-right text-gray-900 dark:text-gray-100">
                        {promo ? formatNumber(promo) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

