'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { addDaysToDateString, todayDateString } from '@/lib/time';

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
  0: 'Р’СЃ',
  1: 'РџРЅ',
  2: 'Р’С‚',
  3: 'РЎСЂ',
  4: 'Р§С‚',
  5: 'РџС‚',
  6: 'РЎР±',
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
    const endDefault = todayDateString();
    const startDefault = addDaysToDateString(endDefault, -30);
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
          throw new Error(json.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ РґР°РЅРЅС‹Рµ РїРѕ Р·Р°РіСЂСѓР·РєРµ');
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
    const end = todayDateString();
    const start = addDaysToDateString(end, -days);
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

    // byWeekday: СѓСЃСЂРµРґРЅСЏРµРј РїРѕ РґРЅСЏРј РЅРµРґРµР»Рё
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
      const order = ['РџРЅ', 'Р’С‚', 'РЎСЂ', 'Р§С‚', 'РџС‚', 'РЎР±', 'Р’СЃ'];
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
            <span className="text-sm text-gray-600 dark:text-gray-300">Р—Р°РіСЂСѓР¶Р°РµРј РґР°РЅРЅС‹Рµ РїРѕ Р·Р°РіСЂСѓР·РєРµ...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-10">
        <div className="mx-auto max-w-xl">
          <AlertBanner
            variant="danger"
            title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё heatmap"
            message={error}
            action={
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  setStartDate((s) => s);
                }}
              >
                РџРѕРїСЂРѕР±РѕРІР°С‚СЊ СЃРЅРѕРІР°
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-6 py-6">
      {/* Р¤РёР»СЊС‚СЂС‹ */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Р¤РёР»СЊС‚СЂС‹</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              РџРµСЂРёРѕРґ Рё С„РёР»РёР°Р» / СЂРµР¶РёРј Р°РіСЂРµРіР°С†РёРё Р·Р°РґР°СЋС‚ СЃСЂРµР· РґР»СЏ РєР°СЂС‚С‹ Р·Р°РіСЂСѓР·РєРё.
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            РџРµСЂРёРѕРґ РґР°РЅРЅС‹С…: {data.period.startDate} вЂ” {data.period.endDate}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* РџРµСЂРёРѕРґ */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              РџРµСЂРёРѕРґ
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
                  {p === '7' && '7 РґРЅРµР№'}
                  {p === '30' && '30 РґРЅРµР№'}
                  {p === '90' && '90 РґРЅРµР№'}
                  {p === 'custom' && 'РљР°СЃС‚РѕРјРЅС‹Р№'}
                </button>
              ))}
            </div>
          </div>

          {/* Р”Р°С‚Р° РЅР°С‡Р°Р»Р° */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Р”Р°С‚Р° РЅР°С‡Р°Р»Р°
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

          {/* Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Р”Р°С‚Р° РѕРєРѕРЅС‡Р°РЅРёСЏ
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

          {/* Р¤РёР»РёР°Р» */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Р¤РёР»РёР°Р»
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Р’СЃРµ С„РёР»РёР°Р»С‹</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Р РµР¶РёРј heatmap */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              Р РµР¶РёРј
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
                РџРѕ РґР°С‚Р°Рј
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
                РџРѕ РґРЅСЏРј РЅРµРґРµР»Рё
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
              РљР°СЂС‚Р° Р·Р°РіСЂСѓР·РєРё РїРѕ С‡Р°СЃР°Рј
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Р¦РІРµС‚ СЏС‡РµР№РєРё РїРѕРєР°Р·С‹РІР°РµС‚ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅСѓСЋ Р·Р°РіСЂСѓР·РєСѓ (РєРѕР»РёС‡РµСЃС‚РІРѕ СѓСЃРїРµС€РЅС‹С… Р±СЂРѕРЅРёСЂРѕРІР°РЅРёР№) РІ РІС‹Р±СЂР°РЅРЅРѕРј СЃСЂРµР·Рµ.
            </p>
          </div>
        </div>

        {cells.length === 0 ? (
          <EmptyState
            compact
            title="РќРµС‚ РґР°РЅРЅС‹С… РїРѕ heatmap"
            description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ Рё С„РёР»СЊС‚СЂС‹ РЅРµС‚ РґРѕСЃС‚Р°С‚РѕС‡РЅРѕРіРѕ РЅР°Р±РѕСЂР° Р±СЂРѕРЅРµР№ РґР»СЏ РєР°СЂС‚С‹ Р·Р°РіСЂСѓР·РєРё."
          />
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full align-middle">
              <div className="grid" style={{ gridTemplateColumns: `80px repeat(24, minmax(24px, 1fr))` }}>
                {/* Р—Р°РіРѕР»РѕРІРѕРє X */}
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-end justify-end pr-2">
                  Р§Р°СЃ
                </div>
                {Array.from({ length: 24 }).map((_, h) => (
                  <div
                    key={h}
                    className="text-[10px] text-gray-500 dark:text-gray-400 text-center py-1 border-b border-gray-100 dark:border-gray-800"
                  >
                    {h}
                  </div>
                ))}

                {/* РЎС‚СЂРѕРєРё РїРѕ Y */}
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
                              ? `${labelY}, ${h}:00 вЂ” ${formatNumber(Math.round(val))} Р±СЂРѕРЅРµР№`
                              : `${labelY}, ${h}:00 вЂ” РЅРµС‚ Р±СЂРѕРЅРµР№`
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
          <span>РњРёРЅ. Р·Р°РіСЂСѓР·РєР°</span>
          <div className="flex-1 h-2 rounded-full bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-600" />
          <span>РњР°РєСЃ. Р·Р°РіСЂСѓР·РєР°</span>
        </div>
      </section>
    </div>
  );
}

