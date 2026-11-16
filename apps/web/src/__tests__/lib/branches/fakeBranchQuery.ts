/**
 * Minimal stand-in for the PostgREST builder used by branch discovery. Each
 * `.range()` call resolves the next queued page; every filter call is recorded.
 */
export type Page = { data: unknown[] | null; error: { message: string } | null };

export function fakeBranchClient(pages: Page[], labels: Record<string, string> = {}) {
    const calls: Array<[string, ...unknown[]]> = [];
    const ranges: Array<[number, number]> = [];
    const selects: string[] = [];
    const queue = [...pages];

    const builder = {
        eq: (...args: unknown[]) => { calls.push(['eq', ...args]); return builder; },
        not: (...args: unknown[]) => { calls.push(['not', ...args]); return builder; },
        gte: (...args: unknown[]) => { calls.push(['gte', ...args]); return builder; },
        lte: (...args: unknown[]) => { calls.push(['lte', ...args]); return builder; },
        contains: (...args: unknown[]) => { calls.push(['contains', ...args]); return builder; },
        order: (...args: unknown[]) => {
            calls.push(['order', ...args]);
            return {
                range: (from: number, to: number) => {
                    ranges.push([from, to]);
                    return Promise.resolve(queue.shift() ?? { data: [], error: null });
                },
            };
        },
    };

    const client = {
        from: (table: string) => {
            if (table === 'categories') {
                return {
                    select: () => ({
                        in: (_column: string, slugs: string[]) => Promise.resolve({
                            data: slugs.filter(slug => labels[slug]).map(slug => ({ slug, name_ru: labels[slug] })),
                            error: null,
                        }),
                    }),
                };
            }
            return { select: (columns: string) => { selects.push(columns); return builder; } };
        },
    };

    return { client, calls, ranges, selects };
}

export function branch(id: string, lat: number, lon: number, business: Record<string, unknown> = {}) {
    return {
        id, name: `Branch ${id}`, address: null, biz_id: `biz-${id}`, lat, lon,
        businesses: { id: `biz-${id}`, name: `Business ${id}`, slug: `business-${id}`, categories: ['barbershop'], ...business },
    };
}
