import { listMobileCategories } from '@/lib/mobileCategoriesService';

function client(result: { data: unknown; error: unknown }) {
    const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue(result),
    };
    return { from: jest.fn().mockReturnValue(chain), chain };
}

describe('listMobileCategories', () => {
    test('returns active categories with trimmed names and drops rows without a slug', async () => {
        const { from, chain } = client({
            data: [{ slug: 'barbershop', name_ru: ' Барбершоп ' }, { slug: '', name_ru: 'x' }, { slug: 'nails', name_ru: '' }],
            error: null,
        });
        const result = await listMobileCategories({ from } as never);
        expect(from).toHaveBeenCalledWith('categories');
        expect(chain.eq).toHaveBeenCalledWith('is_active', true);
        expect(result).toEqual({ ok: true, data: [{ slug: 'barbershop', name_ru: 'Барбершоп' }, { slug: 'nails', name_ru: null }] });
    });

    test('a query error is a 500 without database details', async () => {
        const { from } = client({ data: null, error: { message: 'boom' } });
        expect(await listMobileCategories({ from } as never)).toEqual({
            ok: false, error: 'internal', message: 'Categories are unavailable', status: 500,
        });
    });
});
