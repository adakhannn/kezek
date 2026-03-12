-- Оптимизационные индексы для финансовых запросов
-- Цель: ускорить /api/staff/finance и связанные страницы,
-- которые часто фильтруют по staff_id + дате.

-- Индекс для выборки смен сотрудника по дате
CREATE INDEX IF NOT EXISTS staff_shifts_staff_id_shift_date_idx
    ON staff_shifts (staff_id, shift_date);

-- Индекс для выборки записей (bookings) сотрудника за день
CREATE INDEX IF NOT EXISTS bookings_staff_id_start_at_idx
    ON bookings (staff_id, start_at);

