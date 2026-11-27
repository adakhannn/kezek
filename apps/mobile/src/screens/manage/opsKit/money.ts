import type { Translate } from '../../../i18n';
import { formatNumber } from '../../../utils/format';

export { formatNumber };

/*
 * Numbers and money of the management screens, written as the website writes them: digits in
 * groups of three (a space in ru/ky, a comma in en, the en-US / ru-RU toLocaleString of the
 * website) and the unit from the dictionary ('{amount} сом', 'som' in English). Grouping is done
 * in utils/format (formatNumber), so every device shows the same text.
 */

/** Money as on the website's finance pages: the amount as the server gave it, with the unit. */
export function formatMoney(value: number, t: Translate): string {
    return t('ops.finance.money', { amount: formatNumber(value, t.locale) });
}

/** Money rounded to whole som, as on the website's analytics page (formatCurrencyKGS). */
export function formatMoneyRounded(value: number, t: Translate): string {
    return t('ops.finance.money', { amount: formatNumber(Math.round(value), t.locale, 0) });
}

/** A share in percent with `digits` decimals ('12.5%'); 0% when the total is not positive. */
export function formatShare(value: number, total: number, digits = 1): string {
    return total > 0 ? `${((value / total) * 100).toFixed(digits)}%` : '0%';
}
