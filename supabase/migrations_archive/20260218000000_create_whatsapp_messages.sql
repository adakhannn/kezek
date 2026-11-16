-- Создание таблицы для хранения входящих WhatsApp сообщений
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- WhatsApp данные
    whatsapp_message_id TEXT NOT NULL UNIQUE, -- ID сообщения от Meta
    from_phone TEXT NOT NULL, -- Номер отправителя в формате E.164
    to_phone TEXT, -- Номер получателя (номер бизнеса)
    message_type TEXT NOT NULL, -- text, image, audio, video, document, etc.
    message_text TEXT, -- Текст сообщения (для text типа)
    message_timestamp TIMESTAMPTZ NOT NULL, -- Время получения сообщения от Meta
    -- Привязка к сущностям системы
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Пользователь, если найден по номеру
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL, -- Бронирование, если найдено по контексту
    biz_id UUID REFERENCES businesses(id) ON DELETE SET NULL, -- Бизнес, если определен
    -- Метаданные
    raw_data JSONB, -- Полные данные от Meta для отладки
    processed BOOLEAN DEFAULT false, -- Обработано ли сообщение (для автоматических ответов)
    processed_at TIMESTAMPTZ, -- Время обработки
    -- Временные метки
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from_phone ON whatsapp_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client_id ON whatsapp_messages(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_booking_id ON whatsapp_messages(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_biz_id ON whatsapp_messages(biz_id) WHERE biz_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_created_at ON whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_processed ON whatsapp_messages(processed) WHERE processed = false;

-- RLS политики
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Разрешаем вставку только для service role (через API)
-- Обычные пользователи не должны напрямую вставлять сообщения

-- Разрешаем чтение сообщений:
-- - Пользователь может видеть свои сообщения (client_id = auth.uid())
-- - Менеджеры бизнеса могут видеть сообщения для их бизнеса
CREATE POLICY "Users can view their own messages" ON whatsapp_messages
    FOR SELECT
    USING (
        client_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM businesses b
            WHERE b.id = whatsapp_messages.biz_id
            AND b.owner_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM branch_admins ba
            WHERE ba.branch_id IN (
                SELECT id FROM branches WHERE biz_id = whatsapp_messages.biz_id
            )
            AND ba.user_id = auth.uid()
        )
    );

-- Комментарии
COMMENT ON TABLE whatsapp_messages IS 'Входящие WhatsApp сообщения от клиентов';
COMMENT ON COLUMN whatsapp_messages.whatsapp_message_id IS 'Уникальный ID сообщения от Meta WhatsApp API';
COMMENT ON COLUMN whatsapp_messages.from_phone IS 'Номер отправителя в формате E.164 (например, +996555123456)';
COMMENT ON COLUMN whatsapp_messages.message_type IS 'Тип сообщения: text, image, audio, video, document, location, etc.';
COMMENT ON COLUMN whatsapp_messages.message_text IS 'Текст сообщения (заполняется только для text типа)';
COMMENT ON COLUMN whatsapp_messages.client_id IS 'ID пользователя, если найден по номеру телефона';
COMMENT ON COLUMN whatsapp_messages.booking_id IS 'ID бронирования, если определено по контексту сообщения';
COMMENT ON COLUMN whatsapp_messages.processed IS 'Обработано ли сообщение автоматической системой';
COMMENT ON COLUMN whatsapp_messages.raw_data IS 'Полные данные от Meta для отладки и будущей обработки';



