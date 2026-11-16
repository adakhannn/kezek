import { businessSearchFilter, normalizeBusinessSearchQuery } from '@/lib/businessSearch';

describe('business search filter', () => {
    it('quotes the value so PostgREST syntax in the query cannot add conditions', () => {
        const filter = businessSearchFilter('x,phones.eq.1,(slug.ilike.a)');

        expect(filter).toBe('name.ilike."%x,phones.eq.1,(slug.ilike.a)%",slug.ilike."%x,phones.eq.1,(slug.ilike.a)%"');
    });

    it('escapes LIKE wildcards, backslashes and double quotes', () => {
        // SQL pattern %50\% off \_ "a\\b"% → PostgREST quoted value with \\ and \" escapes.
        expect(businessSearchFilter('50% off _ "a\\b"')).toBe(
            'name.ilike."%50\\\\% off \\\\_ \\"a\\\\\\\\b\\"%",slug.ilike."%50\\\\% off \\\\_ \\"a\\\\\\\\b\\"%"',
        );
    });

    it('normalises input: trims, drops * wildcards and control characters, caps length', () => {
        expect(normalizeBusinessSearchQuery(null)).toBe('');
        expect(normalizeBusinessSearchQuery('  Low*Fade\n ')).toBe('Low Fade');
        expect(normalizeBusinessSearchQuery('a'.repeat(200))).toHaveLength(80);
    });
});
