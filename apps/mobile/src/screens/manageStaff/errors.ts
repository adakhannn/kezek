import { getApiErrorStatus, getErrorMessage, getRawErrorMessage, isNetworkError } from '../../lib/errors';
import type { Translate } from '../../i18n';

/** Written in the script of the UI language and not technical (an API code, an HTTP line, a stack). */
export function isReadableServerMessage(message: string, locale: Translate['locale']): boolean {
    const value = message.trim();
    if (!value || /^[a-z0-9_.:-]+$/i.test(value)) return false;
    if (/\b(typeerror|syntaxerror|http\s*[45]\d{2}|jwt|postgrest|pgrst\d+|supabase|undefined|null)\b|<html/i.test(value)) return false;
    const latin = value.match(/[A-Za-z]/g)?.length ?? 0;
    const cyrillic = value.match(/[А-Яа-яЁёҢңӨөҮү]/g)?.length ?? 0;
    return locale === 'en' ? latin > cyrillic : cyrillic > 0;
}

/**
 * The website shows the server's answer for a refused staff command (dismiss with future bookings,
 * delete with history, a stale transfer...). The app does too when the answer is readable in the
 * app language (the API localizes it by X-Kezek-Locale); otherwise the usual message by status.
 */
export function staffErrorMessage(error: unknown, fallback: string, t: Translate): string {
    if (isNetworkError(error)) return getErrorMessage(error, fallback, t);
    const status = getApiErrorStatus(error);
    const raw = getRawErrorMessage(error);
    if (status !== 401 && isReadableServerMessage(raw, t.locale)) return raw.trim();
    return getErrorMessage(error, fallback, t);
}
