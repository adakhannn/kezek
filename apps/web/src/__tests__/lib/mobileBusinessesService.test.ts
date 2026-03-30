import { listMobileBusinesses } from '@/lib/mobileBusinessesService';

describe('mobileBusinessesService', () => {
    test('applies escaped search and category filters before loading data', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: [],
            error: null,
        });
        const order = jest.fn().mockReturnValue({ limit });
        const contains = jest.fn().mockReturnValue({ order });
        const or = jest.fn().mockReturnValue({ contains, order });
        const eq = jest.fn().mockReturnValue({ or, contains, order });
        const select = jest.fn().mockReturnValue({ eq });
        const from = jest.fn().mockReturnValue({ select });

        const result = await listMobileBusinesses({
            supabase: { from } as never,
            search: 'spa_%test',
            category: 'massage',
        });

        expect(or).toHaveBeenCalledWith('name.ilike.%spa\\_\\%test%,address.ilike.%spa\\_\\%test%');
        expect(contains).toHaveBeenCalledWith('categories', ['massage']);
        expect(result).toEqual({ ok: true, data: [] });
    });

    test('maps database rows to public dto payload', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: [
                {
                    id: 1,
                    name: 'Salon',
                    slug: 'salon',
                    address: 'Main st',
                    phones: ['+996555123456'],
                    categories: ['massage'],
                    rating_score: 4.9,
                },
            ],
            error: null,
        });
        const order = jest.fn().mockReturnValue({ limit });
        const eq = jest.fn().mockReturnValue({ order, or: jest.fn(), contains: jest.fn() });
        const select = jest.fn().mockReturnValue({ eq });
        const from = jest.fn().mockReturnValue({ select });

        const result = await listMobileBusinesses({
            supabase: { from } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: [
                {
                    id: '1',
                    name: 'Salon',
                    slug: 'salon',
                    address: 'Main st',
                    phones: ['+996555123456'],
                    categories: ['massage'],
                    rating_score: 4.9,
                },
            ],
        });
    });

    test('returns internal error payload when query fails', async () => {
        const limit = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'db failed' },
        });
        const order = jest.fn().mockReturnValue({ limit });
        const eq = jest.fn().mockReturnValue({ order, or: jest.fn(), contains: jest.fn() });
        const select = jest.fn().mockReturnValue({ eq });
        const from = jest.fn().mockReturnValue({ select });

        const result = await listMobileBusinesses({
            supabase: { from } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить список бизнесов',
            details: 'db failed',
            status: 500,
        });
    });
});
