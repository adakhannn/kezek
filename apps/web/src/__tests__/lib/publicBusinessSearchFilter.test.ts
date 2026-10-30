import { publicBusinessSearchFilter } from '@/lib/publicBusinessSearchFilter';

describe('publicBusinessSearchFilter', () => {
    it.each(['Ош, улица', 'Street (North): 12.4', 'Shop "Name"', 'Тестовый бизнес 2'])('quotes the whole pattern for %s', query => {
        const filter = publicBusinessSearchFilter(query);
        const quotedPattern = JSON.stringify(`%${query}%`);
        expect(filter).toBe(`name.ilike.${quotedPattern},address.ilike.${quotedPattern}`);
    });

    it('preserves literal LIKE escapes across the PostgREST quoted-string layer', () => {
        const pattern = '%100\\%\\_\\\\road%';
        const quotedPattern = JSON.stringify(pattern);
        expect(publicBusinessSearchFilter('100%_\\road'))
            .toBe(`name.ilike.${quotedPattern},address.ilike.${quotedPattern}`);
    });

    it('keeps normalization and the existing 100-character bound', () => {
        const quotedPattern = JSON.stringify(`%${'x'.repeat(100)}%`);
        expect(publicBusinessSearchFilter(`  ${'x'.repeat(120)}  `))
            .toBe(`name.ilike.${quotedPattern},address.ilike.${quotedPattern}`);
    });
});
