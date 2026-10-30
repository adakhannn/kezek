/** PostgREST transport filter for the existing public business name/address search. */
export function publicBusinessSearchFilter(query: string): string {
    const safeQuery = query.trim().slice(0, 100).replace(/[%_\\]/g, character => `\\${character}`);
    // Quote PostgREST operands (commas/parentheses are grammar delimiters).
    // JSON string escaping preserves quotes/backslashes; the client URL-encodes it.
    const pattern = JSON.stringify(`%${safeQuery}%`);
    return `name.ilike.${pattern},address.ilike.${pattern}`;
}
