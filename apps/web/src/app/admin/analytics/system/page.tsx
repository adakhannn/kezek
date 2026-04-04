'use client';

import { useEffect, useMemo, useState } from 'react';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { addDaysToDateString, todayDateString } from '@/lib/time';

type OverviewSummary = {
  period: {
    startDate: string;
    endDate: string;
  };
  activeBusinesses: number;
  bookings: {
    created: number;
    confirmed: number;
  };
  revenue: {
    total: number;
    avgCheck: number;
  };
};

type OverviewByDayPoint = {
  date: string;
  activeBusinesses: number;
  bookingsConfirmed: number;
  totalRevenue: number;
};

type SystemOverviewResponse = {
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

export default function AdminSystemAnalyticsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<SystemOverviewResponse['data'] | null>(null);

  useEffect(() => {
    const endDefault = todayDateString();
    const startDefault = addDaysToDateString(endDefault, -30);
    setStartDate(startDefault);
    setEndDate(endDefault);
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

        const resp = await fetch(`/admin/api/system-analytics/overview?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const json: SystemOverviewResponse = await resp.json();
        if (!json.ok || !json.data) {
          throw new Error(json.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРёСЃС‚РµРјРЅСѓСЋ Р°РЅР°Р»РёС‚РёРєСѓ');
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

    void load();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate]);

  const trend = useMemo(() => {
    if (!data) return null;
    return data.byDay.map((p) => ({
      date: p.date,
      bookings: p.bookingsConfirmed,
      revenue: p.totalRevenue,
    }));
  }, [data]);

  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    if (preset === 'custom') return;
    const days = preset === '7' ? 7 : preset === '30' ? 30 : 90;
    const end = todayDateString();
    const start = addDaysToDateString(end, -days);
    setStartDate(start);
    setEndDate(end);
  };

  if (loading && !data) {
    return (
      <div className="px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Р—Р°РіСЂСѓР¶Р°РµРј СЃРёСЃС‚РµРјРЅСѓСЋ Р°РЅР°Р»РёС‚РёРєСѓ...</span>
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
            title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё Р°РЅР°Р»РёС‚РёРєРё РїР»Р°С‚С„РѕСЂРјС‹"
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

  const { summary } = data;

  return (
    <div className="space-y-6 py-6 px-4 sm:px-6 lg:px-8">
      <header className="space-y-1">
        <p className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-[11px] font-medium text-indigo-700 dark:text-indigo-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          РЈСЂРѕРІРµРЅСЊ: РїР»Р°С‚С„РѕСЂРјР°
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">РЎРёСЃС‚РµРјРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР°</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          РЎРІРѕРґРєР° РїРѕ РІСЃРµРј Р±РёР·РЅРµСЃР°Рј: Р°РєС‚РёРІРЅРѕСЃС‚СЊ, РІС‹СЂСѓС‡РєР° Рё Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ Р·Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ.
        </p>
      </header>

      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Р¤РёР»СЊС‚СЂС‹</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              РџРµСЂРёРѕРґ Р·Р°РґР°С‘С‚ РѕРєРЅРѕ РґР»СЏ РІСЃРµС… РјРµС‚СЂРёРє Рё С‚СЂРµРЅРґРѕРІ РЅР° СЌС‚РѕРј СЌРєСЂР°РЅРµ.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">РџРµСЂРёРѕРґ</p>
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
                  {p === '7' ? '7 РґРЅРµР№' : p === '30' ? '30 РґРЅРµР№' : p === '90' ? '90 РґРЅРµР№' : 'РЎРІРѕР№ РїРµСЂРёРѕРґ'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">РќР°С‡Р°Р»Рѕ</p>
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
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">РћРєРѕРЅС‡Р°РЅРёРµ</p>
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

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            РђРєС‚РёРІРЅС‹Рµ Р±РёР·РЅРµСЃС‹
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.activeBusinesses)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Р‘СЂРѕРЅРё (СѓСЃРїРµС€РЅС‹Рµ)
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatNumber(summary.bookings.confirmed)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            Р’С‹СЂСѓС‡РєР° Р·Р° РїРµСЂРёРѕРґ
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrencyKGS(summary.revenue.total)}
          </p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
            РЎСЂРµРґРЅРёР№ С‡РµРє
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrencyKGS(summary.revenue.avgCheck)}
          </p>
        </div>
      </section>

      {trend && (
        <section className="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">РўСЂРµРЅРґС‹ РїРѕ РґРЅСЏРј</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                РљР°Рє РјРµРЅСЏР»РёСЃСЊ СѓСЃРїРµС€РЅС‹Рµ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ Рё РІС‹СЂСѓС‡РєР° РїРѕ РїР»Р°С‚С„РѕСЂРјРµ Р·Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ.
              </p>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
            {trend.map((p) => (
              <div key={p.date} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-300">{p.date}</span>
                <div className="flex items-center gap-4">
                  <span className="text-gray-500 dark:text-gray-400">
                    Р‘СЂРѕРЅРё: <span className="font-medium text-gray-900 dark:text-gray-100">{formatNumber(p.bookings)}</span>
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    Р’С‹СЂСѓС‡РєР°:{' '}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {formatCurrencyKGS(p.revenue)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


