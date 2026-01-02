/**
 * Утилиты для валидации форм
 */

export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

export function validatePhone(phone: string): boolean {
    // Убираем все нецифровые символы кроме +
    const cleaned = phone.replace(/[^\d+]/g, '');
    // Проверяем, что номер начинается с + и содержит от 10 до 15 цифр
    return cleaned.startsWith('+') && cleaned.length >= 10 && cleaned.length <= 15;
}

export function validateName(name: string): boolean {
    // Имя должно содержать минимум 2 символа и максимум 100
    const trimmed = name.trim();
    return trimmed.length >= 2 && trimmed.length <= 100;
}

export function normalizePhone(phone: string): string {
    // Убираем все нецифровые символы кроме +
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Если номер не начинается с +, добавляем +996 для кыргызских номеров
    if (!cleaned.startsWith('+')) {
        // Если номер начинается с 0, заменяем на +996
        if (cleaned.startsWith('0')) {
            cleaned = '+996' + cleaned.slice(1);
        } else if (cleaned.length === 9) {
            // Если 9 цифр без префикса, добавляем +996
            cleaned = '+996' + cleaned;
        } else {
            // Иначе просто добавляем +
            cleaned = '+' + cleaned;
        }
    }
    
    return cleaned;
}

export function getValidationError(field: string, value: string): string | null {
    switch (field) {
        case 'email':
            if (!value.trim()) return 'Email обязателен';
            if (!validateEmail(value)) return 'Неверный формат email';
            return null;
        case 'phone':
            if (!value.trim()) return 'Телефон обязателен';
            if (!validatePhone(value)) return 'Неверный формат телефона';
            return null;
        case 'name':
            if (!value.trim()) return 'Имя обязательно';
            if (!validateName(value)) return 'Имя должно содержать от 2 до 100 символов';
            return null;
        case 'code':
            if (!value.trim()) return 'Код обязателен';
            if (value.length !== 6) return 'Код должен содержать 6 цифр';
            if (!/^\d+$/.test(value)) return 'Код должен содержать только цифры';
            return null;
        default:
            return null;
    }
}

