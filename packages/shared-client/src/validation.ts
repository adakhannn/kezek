/**
 * Утилиты для валидации данных на клиенте.
 *
 * Эти функции используются в формах (dashboard, бронирование, auth) и в API‑слое
 * для повторного использования одинаковой бизнес‑валидации на клиенте и сервере.
 * 
 * Используется в web и mobile приложениях.
 */

/**
 * Проверяет, что строка имеет формат UUID v1–v5.
 * @param v Строка-кандидат.
 * @returns `true`, если строка выглядит как корректный UUID, иначе `false`.
 */
export function isUuid(v: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/**
 * Простая проверка email по базовому регулярному выражению.
 * Не учитывает все возможные edge‑кейсы, но достаточна для UI‑валидации.
 */
export function isEmail(s: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/**
 * Проверяет, что строка соответствует формату телефона E.164 (`+` и 1–15 цифр).
 * Подходит для грубой проверки перед отправкой на сервер.
 */
export function isE164(s: string): boolean {
    return /^\+[1-9]\d{1,14}$/.test(s);
}

/**
 * Валидирует координаты широты/долготы и приводит их к числам.
 * @returns `{ ok: true, lat, lon }` для валидных координат или `{ ok: false }`.
 */
export function validateLatLon(lat: unknown, lon: unknown): { ok: false } | { ok: true; lat: number; lon: number } {
    if (lat == null || lon == null) return { ok: false };
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) return { ok: false };
    if (la < -90 || la > 90 || lo < -180 || lo > 180) return { ok: false };
    return { ok: true, lat: la, lon: lo };
}

/**
 * Конвертирует координаты в EWKT‑формат для PostGIS:
 * `SRID=4326;POINT(lon lat)`.
 */
export function coordsToEWKT(lat: number, lon: number): string {
    return `SRID=4326;POINT(${lon} ${lat})`;
}

/**
 * Валидация email с сообщением об ошибке.
 * Email считается опциональным: пустая строка даёт `valid: true`.
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
    if (!email || !email.trim()) {
        return { valid: true }; // Email опционален
    }

    const trimmed = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { valid: false, error: 'Неверный формат email' };
    }

    if (trimmed.length > 255) {
        return { valid: false, error: 'Email слишком длинный (максимум 255 символов)' };
    }

    return { valid: true };
}

/**
 * Валидация телефона в формате E.164 (`+996555123456`).
 * Если `required = false`, пустое значение считается валидным.
 */
export function validatePhone(phone: string, required: boolean = false): { valid: boolean; error?: string } {
    const trimmed = phone.trim();

    if (!trimmed) {
        if (required) {
            return { valid: false, error: 'Телефон обязателен' };
        }
        return { valid: true }; // Телефон опционален
    }

    // Формат E.164: начинается с +, затем код страны (1-3 цифры), затем номер (7-14 цифр)
    const phoneRegex = /^\+[1-9]\d{7,14}$/;

    if (!phoneRegex.test(trimmed)) {
        return { valid: false, error: 'Неверный формат телефона. Используйте формат: +996555123456' };
    }

    return { valid: true };
}

/**
 * Валидация имени: не пустое (если `required = true`), длина от 2 до 100 символов.
 */
export function validateName(name: string, required: boolean = true): { valid: boolean; error?: string } {
    const trimmed = name.trim();

    if (!trimmed) {
        if (required) {
            return { valid: false, error: 'Имя обязательно' };
        }
        return { valid: true };
    }

    if (trimmed.length < 2) {
        return { valid: false, error: 'Имя должно содержать минимум 2 символа' };
    }

    if (trimmed.length > 100) {
        return { valid: false, error: 'Имя слишком длинное (максимум 100 символов)' };
    }

    return { valid: true };
}

/**
 * Универсальная валидация числового значения.
 *
 * Поддерживает:
 * - обязательность (`required`)
 * - минимальное/максимальное значение (`min`/`max`)
 * - запрет нуля (`allowZero = false`).
 */
export function validatePositiveNumber(
    value: number | string,
    options: {
        min?: number;
        max?: number;
        required?: boolean;
        allowZero?: boolean;
    } = {}
): { valid: boolean; error?: string } {
    const { min = 0, max, required = false, allowZero = true } = options;

    if (value === null || value === undefined || value === '') {
        if (required) {
            return { valid: false, error: 'Значение обязательно' };
        }
        return { valid: true };
    }

    const num = typeof value === 'string' ? Number(value) : value;

    if (isNaN(num)) {
        return { valid: false, error: 'Введите число' };
    }

    if (!allowZero && num === 0) {
        return { valid: false, error: 'Значение должно быть больше 0' };
    }

    if (num < min) {
        return { valid: false, error: `Значение должно быть не менее ${min}` };
    }

    if (max !== undefined && num > max) {
        return { valid: false, error: `Значение должно быть не более ${max}` };
    }

    return { valid: true };
}

/**
 * Валидация процента в диапазоне 0..100 (включительно).
 */
export function validatePercent(percent: number | string): { valid: boolean; error?: string } {
    return validatePositiveNumber(percent, { min: 0, max: 100, required: true });
}

/**
 * Валидация диапазона цен: обе цены неотрицательные и `price_from <= price_to`.
 * Если одно из значений не является числом, валидация считается пройденной
 * (интерпретируется как «поле не заполнено»).
 */
export function validatePriceRange(
    priceFrom: number | string,
    priceTo: number | string
): { valid: boolean; error?: string } {
    const from = typeof priceFrom === 'string' ? Number(priceFrom) : priceFrom;
    const to = typeof priceTo === 'string' ? Number(priceTo) : priceTo;

    if (isNaN(from) || isNaN(to)) {
        return { valid: true }; // Если не заполнены, валидация не требуется
    }

    if (from < 0 || to < 0) {
        return { valid: false, error: 'Цены не могут быть отрицательными' };
    }

    if (from > to) {
        return { valid: false, error: 'Минимальная цена не может быть больше максимальной' };
    }

    return { valid: true };
}

/**
 * Валидация суммы процентов: `master + salon ≈ 100` (с небольшой погрешностью).
 */
export function validatePercentSum(
    master: number | string,
    salon: number | string
): { valid: boolean; error?: string } {
    const masterNum = typeof master === 'string' ? Number(master) : master;
    const salonNum = typeof salon === 'string' ? Number(salon) : salon;

    if (isNaN(masterNum) || isNaN(salonNum)) {
        return { valid: false, error: 'Проценты должны быть указаны' };
    }

    const sum = masterNum + salonNum;

    if (Math.abs(sum - 100) > 0.01) {
        // Допускаем небольшую погрешность из-за округления
        return { valid: false, error: 'Сумма процентов должна быть равна 100%' };
    }

    return { valid: true };
}

