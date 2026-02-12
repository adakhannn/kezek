// apps/web/src/app/staff/finance/utils/calculations.ts

/**
 * @deprecated Этот файл больше не используется.
 * 
 * Все функции финансовых расчетов теперь находятся в @/lib/financeDomain
 * и используются напрямую через useShiftCalculations хук.
 * 
 * Этот файл оставлен для обратной совместимости, но будет удален в будущем.
 * 
 * Миграция:
 * - calculateTotalServiceAmount -> @/lib/financeDomain/items
 * - calculateTotalConsumables -> @/lib/financeDomain/items
 * - calculateBaseShares -> @/lib/financeDomain/shares
 * - calculateDisplayShares -> @/lib/financeDomain/display
 * - calculateShiftFinancials -> логика перенесена в useShiftCalculations
 */

// Реэкспортируем для обратной совместимости (если где-то еще используется)
export {
    calculateTotalServiceAmount,
    calculateTotalConsumables,
    calculateBaseShares,
    calculateDisplayShares,
} from '@/lib/financeDomain';

