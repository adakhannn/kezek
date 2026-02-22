-- Создание таблицы для событий воронки бронирования
-- Не содержит PII (персональных данных) - только анонимные идентификаторы

CREATE TABLE IF NOT EXISTS funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'business_view',
        'branch_select',
        'service_select',
        'staff_select',
        'slot_select',
        'booking_success',
        'booking_abandon'
    )),
    source TEXT NOT NULL CHECK (source IN ('public', 'quickdesk')),
    biz_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    service_id UUID REFERENCES services(id) ON DELETE SET NULL,
    staff_id UUID REFERENCES staff(id) ON DELETE SET NULL,
    slot_start_at TIMESTAMPTZ,
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    session_id TEXT NOT NULL, -- Анонимный ID сессии (без PII)
    user_agent TEXT,
    referrer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_funnel_events_biz_id ON funnel_events(biz_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event_type ON funnel_events(event_type);
CREATE INDEX IF NOT EXISTS idx_funnel_events_source ON funnel_events(source);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session_id ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created_at ON funnel_events(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_biz_created ON funnel_events(biz_id, created_at);

-- Композитный индекс для отчетов по конверсии
CREATE INDEX IF NOT EXISTS idx_funnel_events_biz_type_created ON funnel_events(biz_id, event_type, created_at);

-- RLS политики (если нужно ограничить доступ)
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать события своего бизнеса (для менеджеров)
CREATE POLICY "Managers can view funnel events for their business"
    ON funnel_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_roles_with_user ur
            WHERE ur.user_id = auth.uid()
            AND ur.biz_id = funnel_events.biz_id
            AND ur.role_key IN ('owner', 'manager')
        )
    );

-- Политика: все могут вставлять события (для публичного потока)
CREATE POLICY "Anyone can insert funnel events"
    ON funnel_events FOR INSERT
    WITH CHECK (true);

