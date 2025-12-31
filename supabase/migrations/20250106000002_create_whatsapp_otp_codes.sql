-- Создание таблицы для хранения OTP кодов для аутентификации через WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ,
    CONSTRAINT unique_active_otp UNIQUE (phone, code, expires_at)
);

-- Индекс для быстрого поиска по номеру телефона
CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone ON whatsapp_otp_codes(phone);

-- Индекс для очистки истекших кодов
CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_expires ON whatsapp_otp_codes(expires_at);

-- Функция для автоматической очистки истекших кодов (опционально)
-- Можно запускать через cron job

-- RLS политики (если нужно ограничить доступ)
ALTER TABLE whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

-- Разрешаем вставку всем (для анонимных запросов)
CREATE POLICY "Allow insert for OTP codes" ON whatsapp_otp_codes
    FOR INSERT
    WITH CHECK (true);

-- Разрешаем чтение только для service role (через API)
-- Обычные пользователи не должны видеть OTP коды

-- Комментарии
COMMENT ON TABLE whatsapp_otp_codes IS 'Временное хранилище OTP кодов для аутентификации через WhatsApp';
COMMENT ON COLUMN whatsapp_otp_codes.phone IS 'Номер телефона в формате E.164';
COMMENT ON COLUMN whatsapp_otp_codes.code IS '6-значный OTP код';
COMMENT ON COLUMN whatsapp_otp_codes.expires_at IS 'Время истечения кода';
COMMENT ON COLUMN whatsapp_otp_codes.used_at IS 'Время использования кода (null если не использован)';

