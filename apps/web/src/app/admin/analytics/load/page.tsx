'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

type LoadPoint = {
  date: string;
  hour: number;
  bookingsCount: number;
  promoBookingsCount: number;
  staffCount: number | null;
  uniqueClientsCount: number | null;
};

type LoadResponse = {
  ok: boolean;
  data?: {
    bizId: string;
    branchId: string | null;
    period: { startDate: string; endDate: string };
    points: LoadPoint[];
  };
  error?: string;
};

type PeriodPreset = '7' | '30' | '90' | 'custom';
type HeatmapMode = 'byDate' | 'byWeekday';

type BranchOption = { id: string; name: string };

type CellAgg = {
  key: string;
  labelY: string;
  hour: number;
  value: number;
};

function formatNumber(n: number) {
  return n.toLocaleString('ru-RU');
}

const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Вс',
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
};

function getWeekday(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay();
}

function valueToBg(value: number, max: number): string {
  if (max <= 0 || value <= 0) return 'bg-gray-50 dark:bg-gray-900';
  const ratio = Math.min(value / max, 1);
  if (ratio > 0.8) return 'bg-emerald-600 text-white';
  if (ratio > 0.6) return 'bg-emerald-500 text-white';
  if (ratio > 0.4) return 'bg-emerald-400 text-emerald-950';
  if (ratio > 0.2) return 'bg-emerald-200 text-emerald-900';
  return 'bg-emerald-100 text-emerald-900';
}

export default function AdminAnalyticsLoadPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [branchId, setBranchId] = useState<string>('all');
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [mode, setMode] = useState<HeatmapMode>('byDate');
  const [data, setData] = useState<LoadResponse['data'] | null>(null);

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
        // best effort
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

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        if (branchId !== 'all') {
          params.set('branchId', branchId);
        }

        const resp = await fetch(`/admin/api/analytics/load?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const json: LoadResponse = await resp.json();
        if (!json.ok || !json.data) {
          throw new Error(json.error || 'Не удалось загрузить данные по загрузке');
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

    load();
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

  const { cells, maxValue, axisYLabels } = useMemo(() => {
    if (!data) return { cells: [] as CellAgg[], maxValue: 0, axisYLabels: [] as string[] };

    if (mode === 'byDate') {
      const map = new Map<string, CellAgg>();
      data.points.forEach((p) => {
        const key = `${p.date}-${p.hour}`;
        const prev = map.get(key);
        const value = (prev?.value ?? 0) + p.bookingsCount;
        map.set(key, {
          key,
          labelY: p.date,
          hour: p.hour,
          value,
        });
      });
      const sorted = Array.from(map.values()).sort((a, b) =>
        a.labelY === b.labelY ? a.hour - b.hour : a.labelY.localeCompare(b.labelY),
      );
      const max = sorted.reduce((m, c) => (c.value > m ? c.value : m), 0);
      const labels = Array.from(new Set(sorted.map((c) => c.labelY)));
      return { cells: sorted, maxValue: max, axisYLabels: labels };
    }

    // byWeekday: усредняем по дням недели
    const sums = new Map<string, { labelY: string; hour: number; sum: number; countDays: number }>();
    const daysByWeekday = new Map<number, Set<string>>();

    data.points.forEach((p) => {
      const wd = getWeekday(p.date); // 0..6
      const daySet = daysByWeekday.get(wd) ?? new Set<string>();
      daySet.add(p.date);
      daysByWeekday.set(wd, daySet);
      const key = `${wd}-${p.hour}`;
      const prev = sums.get(key);
      const sum = (prev?.sum ?? 0) + p.bookingsCount;
      sums.set(key, {
        labelY: WEEKDAY_LABELS[wd],
        hour: p.hour,
        sum,
        countDays: daySet.size,
      });
    });

    const cellsArr: CellAgg[] = [];
    sums.forEach((v, key) => {
      const avg = v.countDays > 0 ? v.sum / v.countDays : 0;
      cellsArr.push({
        key,
        labelY: v.labelY,
        hour: v.hour,
        value: avg,
      });
    });
    const sorted = cellsArr.sort((a, b) => {
      const order = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      const ai = order.indexOf(a.labelY);
      const bi = order.indexOf(b.labelY);
      if (ai !== bi) return ai - bi;
      return a.hour - b.hour;
    });
    const max = sorted.reduce((m, c) => (c.value > m ? c.value : m), 0);
    const labels = Array.from(new Set(sorted.map((c) => c.labelY)));
    return { cells: sorted, maxValue: max, axisYLabels: labels };
  }, [data, mode]);

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
            <span className="text-sm text-gray-600 dark:text-gray-300">Загружаем данные по загрузке...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <div className="max-w-xl mx-auto bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-red-900 dark:text-red-50 mb-2">Ошибка загрузки heatmap</h1>
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

  return (
    <div className="space-y-6 py-6">
      {/* Фильтры */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Фильтры</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Период и филиал / режим агрегации задают срез для карты загрузки.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Период данных: {data.period.startDate} — {data.period.endDate}
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

          {/* Режим heatmap */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Режим
            </p>
            <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1 text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode('byDate')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  mode === 'byDate'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                По датам
              </button>
              <button
                type="button"
                onClick={() => setMode('byWeekday')}
                className={`px-3 py-1 rounded-full transition-colors ${
                  mode === 'byWeekday'
                    ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400'
                }`}
              >
                По дням недели
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Heatmap */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Карта загрузки по часам
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Цвет ячейки показывает относительную загрузку (количество успешных бронирований) в выбранном срезе.
            </p>
          </div>
        </div>

        {cells.length === 0 ? (
          <div className="h-40 flex items-center justify-center text-xs text-gray-400">
            Нет данных за выбранный период
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(24, minmax(24px, 1fr))` }}>
                {/* Заголовок X */}
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-end justify-end pr-2">
                  Час
                </div>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div
                    key={h}
                    className="text-[10px] text-gray-500 dark:text-gray-400 text-center py-1 border-b border-gray-100 dark:border-gray-800"
                  >
                    {h}
                  </div>
                ))}

                {/* Строки по Y */}
                {axisYLabels.map((labelY) => (
                  <>
                    <div
                      key={`label-${labelY}`}
                      className="text-xs text-gray-700 dark:text-gray-200 py-1 pr-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-end"
                    >
                      {labelY}
                    </div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const cell = cells.find((c) => c.labelY === labelY && c.hour === h);
                      const val = cell?.value ?? 0;
                      const classes = valueToBg(val, maxValue);
                      return (
                        <div
                          key={`${labelY}-${h}`}
                          className={`border-b border-gray-100 dark:border-gray-800 border-l border-gray-50 dark:border-gray-900 text-[10px] text-center cursor-default ${classes}`}
                          title={
                            val > 0
                              ? `${labelY}, ${h}:00 — ${formatNumber(Math.round(val))} броней`
                              : `${labelY}, ${h}:00 — нет броней`
                          }
                        >
                          {val > 0 ? Math.round(val) : ''}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 pt-2">
          <span>Мин. загрузка</span>
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-600" />
          <span>Макс. загрузка</span>
        </div>
      </section>
    </div>
  );
}
