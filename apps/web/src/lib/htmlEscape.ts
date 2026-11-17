/**
 * Escapes text for HTML element content and quoted attribute values. Use it for every value
 * that reaches an HTML e-mail or a Telegram message sent with parse_mode HTML: names, phones,
 * addresses and service titles come from clients, guests and businesses.
 */
export function escapeHtml(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
