'use client';

export type PersistedAnalyticsFilters = {
  startDate?: string;
  endDate?: string;
  branchId?: string;
  channel?: 'all' | 'web' | 'mobile';
};

const STORAGE_KEY = 'adminAnalyticsFilters:v1';

export function loadPersistedAnalyticsFilters(): PersistedAnalyticsFilters {
  if (typeof window === 'undefined') return {};

  let stored: PersistedAnalyticsFilters = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      stored = JSON.parse(raw) ?? {};
    }
  } catch {
    // ignore
  }

  const url = new URL(window.location.href);
  const fromUrl: PersistedAnalyticsFilters = {
    startDate: url.searchParams.get('startDate') || undefined,
    endDate: url.searchParams.get('endDate') || undefined,
    branchId: url.searchParams.get('branchId') || undefined,
    channel: (url.searchParams.get('channel') as PersistedAnalyticsFilters['channel']) || undefined,
  };

  return {
    ...stored,
    ...fromUrl,
  };
}

export function persistAnalyticsFilters(next: PersistedAnalyticsFilters): void {
  if (typeof window === 'undefined') return;

  // merge with previous stored
  let current: PersistedAnalyticsFilters = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      current = JSON.parse(raw) ?? {};
    }
  } catch {
    // ignore
  }

  const merged: PersistedAnalyticsFilters = {
    ...current,
    ...next,
  };

  // update URL query
  const url = new URL(window.location.href);

  if (merged.startDate) url.searchParams.set('startDate', merged.startDate);
  else url.searchParams.delete('startDate');

  if (merged.endDate) url.searchParams.set('endDate', merged.endDate);
  else url.searchParams.delete('endDate');

  if (merged.branchId && merged.branchId !== 'all') url.searchParams.set('branchId', merged.branchId);
  else url.searchParams.delete('branchId');

  if (merged.channel && merged.channel !== 'all') url.searchParams.set('channel', merged.channel);
  else url.searchParams.delete('channel');

  window.history.replaceState(null, '', url.toString());

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore storage errors
  }
}

