/**
 * Public business typeahead. The query text is user input that ends up inside
 * a PostgREST logic tree (`or=(...)`), where `,` `.` `(` `)` are syntax: without
 * quoting, a crafted `q` could add filters on any column and use the endpoint
 * as an oracle. LIKE wildcards are escaped too, so `%` and `_` match literally.
 */

const MAX_QUERY_LENGTH = 80;

export function normalizeBusinessSearchQuery(value: string | null): string {
    // `*` is PostgREST's alias for the LIKE wildcard, so it is dropped as well.
    return (value ?? '').replace(/[*\u0000-\u001f]/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
}

/** A double-quoted PostgREST value whose SQL ILIKE pattern matches `q` as a substring. */
function containsPattern(q: string): string {
    const like = `%${q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    return `"${like.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

export function businessSearchFilter(q: string): string {
    const pattern = containsPattern(q);
    return `name.ilike.${pattern},slug.ilike.${pattern}`;
}
