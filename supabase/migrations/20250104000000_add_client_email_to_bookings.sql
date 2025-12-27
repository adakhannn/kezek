-- Добавляем поле client_email в таблицу bookings для гостевых броней
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS client_email text;

-- Комментарий к полю
COMMENT ON COLUMN bookings.client_email IS 'Email клиента для гостевых броней (если указан)';

