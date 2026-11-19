// CI-04: the Supabase test mocks record queries, and expectBusinessScoped fails a query that is not
// limited to the business.
import { createMockSupabase, createTableMock, expectBusinessScoped, recordQueries } from './testHelpers';

describe('Supabase test mocks (CI-04)', () => {
    test('createTableMock answers per table and records every builder call', async () => {
        const client = createTableMock({
            staff: { data: [{ id: 's1' }] },
            branches: (query) => ({ data: query.calls.some(([method]) => method === 'maybeSingle') ? { id: 'b1' } : [] }),
        });

        const staff = await client.from('staff').select('id').eq('biz_id', 'biz-1').order('full_name');
        const branch = await client.from('branches').select('id').eq('id', 'b1').maybeSingle();

        expect(staff).toEqual({ data: [{ id: 's1' }], error: null, count: null });
        expect(branch).toEqual({ data: { id: 'b1' }, error: null, count: null });
        expect(client.queries).toEqual([
            { table: 'staff', calls: [['select', 'id'], ['eq', 'biz_id', 'biz-1'], ['order', 'full_name']] },
            { table: 'branches', calls: [['select', 'id'], ['eq', 'id', 'b1'], ['maybeSingle']] },
        ]);
    });

    test('expectBusinessScoped accepts filtered reads and writes for the business', async () => {
        const client = createTableMock();
        await client.from('services').select('id').eq('biz_id', 'biz-1');
        await client.from('services').update({ active: false }).match({ biz_id: 'biz-1', id: 'x' });
        await client.from('services').insert([{ biz_id: 'biz-1', name_ru: 'A' }, { biz_id: 'biz-1', name_ru: 'B' }]);

        expect(() => expectBusinessScoped(client, 'services', 'biz-1')).not.toThrow();
    });

    test.each([
        ['a read without the filter', (client: ReturnType<typeof createTableMock>) => client.from('staff').select('id').eq('id', 's1')],
        ['a read of another business', (client: ReturnType<typeof createTableMock>) => client.from('staff').select('id').eq('biz_id', 'biz-2')],
        ['an update by id only', (client: ReturnType<typeof createTableMock>) => client.from('staff').update({ is_active: false }).eq('id', 's1')],
        ['a row written without the business', (client: ReturnType<typeof createTableMock>) => client.from('staff').insert({ full_name: 'X' })],
    ])('expectBusinessScoped fails %s', async (_label, query) => {
        const client = createTableMock();
        await query(client);
        expect(() => expectBusinessScoped(client, 'staff', 'biz-1')).toThrow(/staff: /);
    });

    test('expectBusinessScoped fails when nothing was read from the table', () => {
        expect(() => expectBusinessScoped(createTableMock(), 'staff', 'biz-1')).toThrow('no query on staff was recorded');
    });

    test('createMockSupabase records queries built through its own chain', () => {
        const client = createMockSupabase();
        client.from('branches').select('id').eq('biz_id', 'biz-1').eq('name', 'Center');

        expect(client.queries).toEqual([{ table: 'branches', calls: [['select', 'id'], ['eq', 'biz_id', 'biz-1'], ['eq', 'name', 'Center']] }]);
        expect(() => expectBusinessScoped(client, 'branches', 'biz-1')).not.toThrow();
    });

    test('recordQueries logs the calls on chains a test gives from() and keeps the mock working', async () => {
        const mock = createMockSupabase();
        mock.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'b1' }, error: null }),
        });
        const log = recordQueries(mock);

        const branch = await log.client.from('branches').select('id').eq('id', 'b1').eq('biz_id', 'biz-1').maybeSingle();

        expect(branch).toEqual({ data: { id: 'b1' }, error: null });
        expect(mock.from).toHaveBeenCalledWith('branches');
        expect(log.queries).toEqual([{ table: 'branches', calls: [['select', 'id'], ['eq', 'id', 'b1'], ['eq', 'biz_id', 'biz-1'], ['maybeSingle']] }]);
        expect(() => expectBusinessScoped(log, 'branches', 'biz-1')).not.toThrow();
        expect(() => expectBusinessScoped(log, 'branches', 'biz-2')).toThrow(/branches: /);
    });
});
