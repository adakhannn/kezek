'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

import { AlertBanner } from '@/components/ui/AlertBanner';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { addDaysToDateString, todayDateString } from '@/lib/time';

type FunnelStep = {
  id: string;
  label: string;
  sessions: number;
  conversionFromPrev: number | null;
};

type FunnelResponse = {
  ok: boolean;
  data?: {
    steps: FunnelStep[];
    overallConversion: number;
    period: { startDate: string; endDate: string };
  };
  error?: string;
};

type PeriodPreset = '7' | '30' | '90' | 'custom';
type SourceFilter = 'all' | 'web' | 'mobile';

function formatPercent(value: number | null | undefined) {
  if (value == null) return 'вЂ”';
  return `${value.toFixed(2)}%`;
}

export default function AdminAnalyticsFunnelPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [data, setData] = useState<FunnelResponse['data'] | null>(null);

  useEffect(() => {
    const endDefault = todayDateString();
    const startDefault = addDaysToDateString(endDefault, -30);
    const persisted = loadPersistedAnalyticsFilters();

    setStartDate(persisted.startDate ?? startDefault);
    setEndDate(persisted.endDate ?? endDefault);
    if (persisted.channel) {
      setSource(persisted.channel as SourceFilter);
    }
  }, []);

  useEffect(() => {
    if (!startDate || !endDate) return;
    let ignore = false;

    async function loadFunnel() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        params.set('startDate', startDate);
        params.set('endDate', endDate);
        if (source !== 'all') {
          params.set('source', source);
        }

        const resp = await fetch(`/admin/api/analytics/conversion-funnel?${params.toString()}`, {
          cache: 'no-store',
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const json: FunnelResponse = await resp.json();
        if (!json.ok || !json.data) {
          throw new Error(json.error || 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ Р°РЅР°Р»РёС‚РёРєСѓ РІРѕСЂРѕРЅРєРё');
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

    loadFunnel();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate, source]);

  const maxSessions = useMemo(() => {
    if (!data?.steps?.length) return 0;
    return Math.max(...data.steps.map((s) => s.sessions));
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

  useEffect(() => {
    if (!startDate || !endDate) return;
    persistAnalyticsFilters({
      startDate,
      endDate,
      channel: source,
    });
  }, [startDate, endDate, source]);

  if (loading && !data) {
    return (
      <div className="px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-300">Р—Р°РіСЂСѓР¶Р°РµРј Р°РЅР°Р»РёС‚РёРєСѓ РІРѕСЂРѕРЅРєРё...</span>
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
            title="РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РІРѕСЂРѕРЅРєРё"
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
              РџРµСЂРёРѕРґ Рё РєР°РЅР°Р» Р·Р°РґР°СЋС‚ СЃСЂРµР· РґР»СЏ СЃРѕР±С‹С‚РёР№ РІРѕСЂРѕРЅРєРё.
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

          {/* Р”Р°С‚С‹ */}
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

          {/* РљР°РЅР°Р» */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              РљР°РЅР°Р»
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">Р’СЃРµ (web + mobile)</option>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
        </div>
      </section>

      {/* РЎРІРѕРґРєР° РїРѕ РІРѕСЂРѕРЅРєРµ */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            РћР±С‰Р°СЏ РєРѕРЅРІРµСЂСЃРёСЏ РІРѕСЂРѕРЅРєРё
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatPercent(data.overallConversion)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            РћС‚ РїРµСЂРІРѕРіРѕ С€Р°РіР° (РїСЂРѕСЃРјРѕС‚СЂС‹ РіР»Р°РІРЅРѕР№) РґРѕ СѓСЃРїРµС€РЅРѕР№ Р±СЂРѕРЅРё.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm col-span-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            РЁР°РіРё РІРѕСЂРѕРЅРєРё
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Р”Р»СЏ РєР°Р¶РґРѕРіРѕ С€Р°РіР° РїРѕРєР°Р·Р°РЅРѕ РєРѕР»РёС‡РµСЃС‚РІРѕ СЃРµСЃСЃРёР№ Рё РєРѕРЅРІРµСЂСЃРёСЏ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РїСЂРµРґС‹РґСѓС‰РµРіРѕ С€Р°РіР°.
          </p>
        </div>
      </section>

      {/* Р’РёР·СѓР°Р»РёР·Р°С†РёСЏ РІРѕСЂРѕРЅРєРё */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Р’РѕСЂРѕРЅРєР° С€Р°РіРѕРІ Р±СЂРѕРЅРёСЂРѕРІР°РЅРёСЏ
        </h3>
        {data.steps.length === 0 ? (
          <EmptyState
            compact
            title="РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РІРѕСЂРѕРЅРєРµ"
            description="Р—Р° РІС‹Р±СЂР°РЅРЅС‹Р№ РїРµСЂРёРѕРґ Рё СЃСЂРµР· РЅРµС‚ СЃРѕР±С‹С‚РёР№, РєРѕС‚РѕСЂС‹Рµ РјРѕР¶РЅРѕ РїРѕРєР°Р·Р°С‚СЊ РІ РѕС‚С‡РµС‚Рµ."
          />
        ) : (
          <div className="space-y-4">
            {data.steps.map((step, index) => {
              const widthPercent = maxSessions > 0 ? Math.max((step.sessions / maxSessions) * 100, 5) : 0;
              const tooltip = [
                `${step.label}`,
                `РЎРµСЃСЃРёР№ РЅР° С€Р°РіРµ: ${step.sessions}`,
                index === 0
                  ? `РљРѕРЅРІРµСЂСЃРёСЏ РѕС‚ РЅР°С‡Р°Р»Р° РІРѕСЂРѕРЅРєРё: ${formatPercent(data.overallConversion)}`
                  : `РљРѕРЅРІРµСЂСЃРёСЏ РѕС‚ РїСЂРµРґС‹РґСѓС‰РµРіРѕ С€Р°РіР°: ${formatPercent(step.conversionFromPrev)}`,
              ].join(' вЂў ');

              return (
                <div
                  key={step.id}
                  className="group relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 p-4"
                  title={tooltip}
                >
                  <div className="flex items-center justify-between mb-2 gap-4">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.label}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          РЎРµСЃСЃРёР№: <span className="font-semibold">{step.sessions}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      {index === 0 ? (
                        <>
                          <p>РЎС‚Р°СЂС‚ РІРѕСЂРѕРЅРєРё</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatPercent(data.overallConversion)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p>РљРѕРЅРІРµСЂСЃРёСЏ РѕС‚ РїСЂРѕС€Р». С€Р°РіР°</p>
                          <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {formatPercent(step.conversionFromPrev)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                    РќР°РІРµРґРёС‚Рµ РєСѓСЂСЃРѕСЂ, С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ РїРѕРґСЂРѕР±РЅС‹Рµ Р·РЅР°С‡РµРЅРёСЏ.
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

