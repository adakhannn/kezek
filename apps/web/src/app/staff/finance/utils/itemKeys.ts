// apps/web/src/app/staff/finance/utils/itemKeys.ts

import type { ShiftItem } from '../types';

/**
 * Генерирует стабильный ключ для элемента списка клиентов
 * Использует id если есть, иначе создает временный ключ на основе createdAt
 */
export function getItemKey(item: ShiftItem, index: number): string {
    if (item.id) {
        return item.id;
    }
    
    // Для новых элементов без id используем createdAt + индекс как временный ключ
    // Это обеспечивает стабильность ключа между рендерами
    if (item.createdAt) {
        return `temp-${item.createdAt}-${index}`;
    }
    
    // Fallback: используем индекс только если нет ни id, ни createdAt
    // Это должно быть крайне редко
    return `temp-${index}`;
}

/**
 * Генерирует временный UUID для нового элемента
 * Используется при создании нового клиента
 */
export function generateTempId(): string {
    // Используем timestamp + случайное число для уникальности
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

