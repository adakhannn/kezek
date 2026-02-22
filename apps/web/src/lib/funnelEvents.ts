/**
 * Событийная модель для воронок бронирования
 * 
 * Отслеживает события без привязки к PII (персональным данным)
 */

export type FunnelEventType =
    | 'business_view'           // Просмотр бизнеса (публичный поток)
    | 'branch_select'           // Выбор филиала
    | 'service_select'          // Выбор услуги
    | 'staff_select'            // Выбор мастера
    | 'slot_select'             // Выбор слота
    | 'booking_success'         // Успешная бронь
    | 'booking_abandon';        // Отказ от бронирования

export type FunnelSource = 'public' | 'quickdesk';

export type FunnelEvent = {
    event_type: FunnelEventType;
    source: FunnelSource;
    biz_id: string;
    branch_id?: string | null;
    service_id?: string | null;
    staff_id?: string | null;
    slot_start_at?: string | null;
    booking_id?: string | null;
    session_id: string;          // Анонимный ID сессии (без PII)
    user_agent?: string | null;
    referrer?: string | null;
    timestamp: string;
    metadata?: Record<string, unknown> | null;
};

/**
 * Отправляет событие воронки на сервер
 * Не содержит PII - только анонимные идентификаторы
 */
export async function trackFunnelEvent(event: Omit<FunnelEvent, 'timestamp'>) {
    try {
        const response = await fetch('/api/funnel-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...event,
                timestamp: new Date().toISOString(),
            }),
        });

        if (!response.ok) {
            console.warn('Failed to track funnel event', event.event_type);
        }
    } catch (error) {
        // Не блокируем основной поток при ошибках отслеживания
        console.warn('Error tracking funnel event', error);
    }
}

/**
 * Генерирует или получает анонимный ID сессии
 * Хранится в sessionStorage (не localStorage для безопасности)
 */
export function getSessionId(): string {
    if (typeof window === 'undefined') {
        return 'server-session';
    }

    const key = 'funnel_session_id';
    let sessionId = sessionStorage.getItem(key);

    if (!sessionId) {
        // Генерируем случайный ID (не содержит PII)
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        sessionStorage.setItem(key, sessionId);
    }

    return sessionId;
}

