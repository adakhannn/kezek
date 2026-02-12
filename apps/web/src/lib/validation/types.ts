/**
 * TypeScript типы, сгенерированные из Zod схем
 * 
 * Этот файл экспортирует типы, выведенные из Zod схем, обеспечивая
 * единый источник истины для валидации и типизации.
 * 
 * Использование:
 * ```typescript
 * import type { ShiftItem, SaveShiftItemsRequest, CloseShiftRequest } from '@/lib/validation/types';
 * ```
 */

import type { z } from 'zod';

import {
    shiftItemSchema,
    shiftItemsArraySchema,
    saveShiftItemsSchema,
    closeShiftSchema,
} from './schemas';

/**
 * Тип элемента смены, выведенный из Zod схемы
 */
export type ShiftItem = z.infer<typeof shiftItemSchema>;

/**
 * Тип массива элементов смены
 */
export type ShiftItemsArray = z.infer<typeof shiftItemsArraySchema>;

/**
 * Тип запроса сохранения элементов смены
 */
export type SaveShiftItemsRequest = z.infer<typeof saveShiftItemsSchema>;

/**
 * Тип запроса закрытия смены
 */
export type CloseShiftRequest = z.infer<typeof closeShiftSchema>;

