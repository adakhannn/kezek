'use client';

import { useEffect, useMemo, useState } from 'react';

import { loadPersistedAnalyticsFilters, persistAnalyticsFilters } from '../filterPersistence';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
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
  if (value == null) return '—';
  return `${value.toFixed(2)}%`;
}

export default function AdminAnalyticsFunnelPage() {
  const { t } = useLanguage();
  // The API sends Russian step labels; known step ids are named in the page language.
  const stepLabel = (step: FunnelStep) => {
    switch (step.id) {
      case 'home_view': return t('admin.analyticsFunnel.step.home_view', step.label);
      case 'business_page_view': return t('admin.analyticsFunnel.step.business_page_view', step.label);
      case 'booking_flow_start': return t('admin.analyticsFunnel.step.booking_flow_start', step.label);
      case 'booking_created': return t('admin.analyticsFunnel.step.booking_created', step.label);
      case 'booking_confirmed_or_paid': return t('admin.analyticsFunnel.step.booking_confirmed_or_paid', step.label);
      default: return step.label;
    }
  };
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
          throw new Error(json.error || t('admin.analyticsFunnel.loadFailed', 'Не удалось загрузить аналитику воронки'));
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
  }, [startDate, endDate, source, t]);

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
            <span className="text-sm text-gray-600 dark:text-gray-300">{t('admin.analyticsFunnel.loading', 'Загружаем аналитику воронки...')}</span>
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
            title={t('admin.analyticsFunnel.errorTitle', 'Ошибка загрузки воронки')}
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
                {t('admin.analyticsFilters.retry', 'Попробовать снова')}
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
      {/* Фильтры */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t('admin.analyticsFilters.filters', 'Фильтры')}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('admin.analyticsFunnel.filtersHint', 'Период и канал задают срез для событий воронки.')}
            </p>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {t('admin.analyticsFilters.dataPeriod', 'Период данных: {start} — {end}').replace('{start}', data.period.startDate).replace('{end}', data.period.endDate)}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
          {/* Период */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {t('admin.analyticsFilters.period', 'Период')}
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
                  {p === '7' && t('admin.analyticsFilters.days7', '7 дней')}
                  {p === '30' && t('admin.analyticsFilters.days30', '30 дней')}
                  {p === '90' && t('admin.analyticsFilters.days90', '90 дней')}
                  {p === 'custom' && t('admin.analyticsFilters.custom', 'Кастомный')}
                </button>
              ))}
            </div>
          </div>

          {/* Даты */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {t('admin.analyticsFilters.startDate', 'Дата начала')}
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
              {t('admin.analyticsFilters.endDate', 'Дата окончания')}
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

          {/* Канал */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
              {t('admin.analyticsFunnel.channel', 'Канал')}
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as SourceFilter)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">{t('admin.analyticsFunnel.channelAll', 'Все (web + mobile)')}</option>
              <option value="web">Web</option>
              <option value="mobile">Mobile</option>
            </select>
          </div>
        </div>
      </section>

      {/* Сводка по воронке */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t('admin.analyticsFunnel.overallTitle', 'Общая конверсия воронки')}
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatPercent(data.overallConversion)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.analyticsFunnel.overallHint', 'От первого шага (просмотры главной) до успешной брони.')}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm col-span-2">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t('admin.analyticsFunnel.stepsTitle', 'Шаги воронки')}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('admin.analyticsFunnel.stepsHint', 'Для каждого шага показано количество сессий и конверсия относительно предыдущего шага.')}
          </p>
        </div>
      </section>

      {/* Визуализация воронки */}
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('admin.analyticsFunnel.chartTitle', 'Воронка шагов бронирования')}
        </h3>
        {data.steps.length === 0 ? (
          <EmptyState
            compact
            title={t('admin.analyticsFunnel.emptyTitle', 'Нет данных по воронке')}
            description={t('admin.analyticsFunnel.emptyDescription', 'За выбранный период и срез нет событий, которые можно показать в отчёте.')}
          />
        ) : (
          <div className="space-y-4">
            {data.steps.map((step, index) => {
              const widthPercent = maxSessions > 0 ? Math.max((step.sessions / maxSessions) * 100, 5) : 0;
              const tooltip = [
                stepLabel(step),
                t('admin.analyticsFunnel.tooltipSessions', 'Сессий на шаге: {count}').replace('{count}', String(step.sessions)),
                index === 0
                  ? t('admin.analyticsFunnel.tooltipFromStart', 'Конверсия от начала воронки: {value}').replace('{value}', formatPercent(data.overallConversion))
                  : t('admin.analyticsFunnel.tooltipFromPrev', 'Конверсия от предыдущего шага: {value}').replace('{value}', formatPercent(step.conversionFromPrev)),
              ].join(' • ');

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
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{stepLabel(step)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {t('admin.analyticsFunnel.sessions', 'Сессий:')} <span className="font-semibold">{step.sessions}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                      {index === 0 ? (
                        <>
                          <p>{t('admin.analyticsFunnel.funnelStart', 'Старт воронки')}</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatPercent(data.overallConversion)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p>{t('admin.analyticsFunnel.fromPrevShort', 'Конверсия от прошл. шага')}</p>
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
                    {t('admin.analyticsFunnel.hoverHint', 'Наведите курсор, чтобы увидеть подробные значения.')}
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


