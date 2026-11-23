/**
 * Утилиты для валидации форм
 */

import { createTranslate, type Translate } from '../i18n/translate';

const translateRu: Translate = createTranslate('ru');

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

/** The validation message of a field in the screen's language (`t` from `useLanguage()`); Russian without `t`. */
export function getValidationError(field: string, value: string, t: Translate = translateRu): string | null {
    switch (field) {
        case 'email':
            if (!value.trim()) return t('cabinet.validation.emailRequired');
            if (!validateEmail(value)) return t('cabinet.validation.emailInvalid');
            return null;
        case 'phone':
            if (!value.trim()) return t('cabinet.validation.phoneRequired');
            if (!validatePhone(value)) return t('cabinet.validation.phoneInvalid');
            return null;
        case 'name':
            if (!value.trim()) return t('cabinet.validation.nameRequired');
            if (!validateName(value)) return t('cabinet.validation.nameLength');
            return null;
        case 'code':
            if (!value.trim()) return t('cabinet.validation.codeRequired');
            if (value.length !== 6) return t('cabinet.validation.codeLength');
            if (!/^\d+$/.test(value)) return t('cabinet.validation.codeDigits');
            return null;
        default:
            return null;
    }
}

