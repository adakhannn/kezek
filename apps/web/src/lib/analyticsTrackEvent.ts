 'use client';

import { useEffect } from 'react';

type AnalyticsEventParams = {
  eventType: string;
  bizId?: string;
  branchId?: string;
  bookingId?: string;
  source: 'web' | 'mobile' | string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

export async function trackEvent(params: AnalyticsEventParams): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const body = {
      event_type: params.eventType,
      biz_id: params.bizId ?? null,
      branch_id: params.branchId ?? null,
      booking_id: params.bookingId ?? null,
      source: params.source,
      session_id: params.sessionId ?? getOrCreateSessionId(),
      metadata: params.metadata ?? {},
    };

    void fetch('/api/admin/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Аналитика не должна ломать основной UX, ошибки игнорируем
  }
}

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  const KEY = 'analytics_session_id';
  try {
    const existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;
    const next =
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? (crypto.randomUUID as () => string)()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    window.sessionStorage.setItem(KEY, next);
    return next;
  } catch {
    return '';
  }
}

type BusinessPageTrackerProps = {
  bizId?: string;
};

export function HomeViewTracker() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const KEY = 'analytics_home_view_logged';
    try {
      if (window.sessionStorage.getItem(KEY)) return;
      window.sessionStorage.setItem(KEY, '1');
    } catch {
      // если sessionStorage недоступен — всё равно пробуем отправить событие один раз
    }

    void trackEvent({
      eventType: 'home_view',
      source: 'web',
      metadata: {
        locale:
          typeof document !== 'undefined'
            ? document.documentElement.lang || undefined
            : undefined,
      },
    });
  }, []);

  return null;
}

export function BusinessPageViewTracker({ bizId }: BusinessPageTrackerProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const KEY_PREFIX = 'analytics_business_view_logged_';
    const key = `${KEY_PREFIX}${bizId ?? 'unknown'}`;

    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // fallback: всё равно пытаемся отправить событие
    }

    void trackEvent({
      eventType: 'business_page_view',
      bizId,
      source: 'web',
      metadata: {
        locale:
          typeof document !== 'undefined'
            ? document.documentElement.lang || undefined
            : undefined,
      },
    });
  }, [bizId]);

  return null;
}

/** Один раз за сессию для данного бизнеса шлёт booking_flow_start. Вызывать при монтировании страницы /b/[slug]/booking. */
export function useBookingFlowStart(bizId: string | undefined) {
  useEffect(() => {
    if (typeof window === 'undefined' || !bizId) return;
    const KEY_PREFIX = 'analytics_booking_flow_start_';
    const key = `${KEY_PREFIX}${bizId}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // ignore
    }
    void trackEvent({
      eventType: 'booking_flow_start',
      bizId,
      source: 'web',
      metadata: {
        locale:
          typeof document !== 'undefined'
            ? document.documentElement.lang || undefined
            : undefined,
      },
    });
  }, [bizId]);
}

/** Шлёт booking_flow_step с step в metadata. Вызывать при выборе филиала/дня/мастера/услуги/слота. */
export function trackBookingFlowStep(params: {
  bizId: string;
  branchId?: string | null;
  step: 'branch' | 'date' | 'staff' | 'service' | 'slot';
  staffId?: string | null;
  serviceId?: string | null;
}) {
  void trackEvent({
    eventType: 'booking_flow_step',
    bizId: params.bizId,
    branchId: params.branchId ?? undefined,
    source: 'web',
    metadata: {
      step: params.step,
      ...(params.staffId && { staff_id: params.staffId }),
      ...(params.serviceId && { service_id: params.serviceId }),
      locale:
        typeof document !== 'undefined'
          ? document.documentElement.lang || undefined
          : undefined,
    },
  });
}

