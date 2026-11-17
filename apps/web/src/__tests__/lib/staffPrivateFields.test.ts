import type { SupabaseClient } from '@supabase/supabase-js';

import { readStaffPrivateFields } from '@/lib/staffPrivateFields';

const row = { id: 'staff-1', biz_id: 'biz-1', percent_master: 60, percent_salon: 40, hourly_rate: null, email: 'a@unit.test' };
const client = (result: { data: unknown; error: unknown }) => ({ rpc: jest.fn().mockResolvedValue(result) });

describe('readStaffPrivateFields', () => {
    test('calls the checking function with the staff id and returns its single row', async () => {
        const supabase = client({ data: [row], error: null });
        await expect(readStaffPrivateFields(supabase as unknown as Pick<SupabaseClient, 'rpc'>, 'staff-1'))
            .resolves.toEqual({ data: row, error: null });
        expect(supabase.rpc).toHaveBeenCalledWith('staff_private_fields', { p_staff_id: 'staff-1' });
    });

    test('accepts an object result and maps an empty result to null', async () => {
        await expect(readStaffPrivateFields(client({ data: row, error: null }) as never, 'staff-1')).resolves.toEqual({ data: row, error: null });
        await expect(readStaffPrivateFields(client({ data: [], error: null }) as never, 'missing')).resolves.toEqual({ data: null, error: null });
        await expect(readStaffPrivateFields(client({ data: null, error: null }) as never, 'missing')).resolves.toEqual({ data: null, error: null });
    });

    test.each(['PGRST202', '42883'])('before the function migration reaches the database (%s) reads the row directly', async (code) => {
        const maybeSingle = jest.fn().mockResolvedValue({ data: row, error: null });
        const eq = jest.fn(() => ({ maybeSingle }));
        const select = jest.fn(() => ({ eq }));
        const supabase = { rpc: jest.fn().mockResolvedValue({ data: null, error: { code, message: 'missing function' } }), from: jest.fn(() => ({ select })) };
        await expect(readStaffPrivateFields(supabase as never, 'staff-1')).resolves.toEqual({ data: row, error: null });
        expect(supabase.from).toHaveBeenCalledWith('staff');
        expect(select).toHaveBeenCalledWith(expect.stringContaining('percent_master'));
        expect(eq).toHaveBeenCalledWith('id', 'staff-1');
    });

    test('a refused fallback read is reported, not hidden', async () => {
        const maybeSingle = jest.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
        const supabase = { rpc: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing function' } }),
            from: jest.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle }) }) })) };
        await expect(readStaffPrivateFields(supabase as never, 'staff-1'))
            .resolves.toEqual({ data: null, error: { code: '42501', message: 'permission denied' } });
    });

    test('other errors never fall back to a direct read', async () => {
        const supabase = { rpc: jest.fn().mockResolvedValue({ data: null, error: { code: '42501', message: 'STAFF_FORBIDDEN' } }), from: jest.fn() };
        await readStaffPrivateFields(supabase as never, 'staff-2');
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('keeps the refusal code so callers can answer not found', async () => {
        const refused = client({ data: null, error: { code: '42501', message: 'STAFF_FORBIDDEN', details: 'internal' } });
        await expect(readStaffPrivateFields(refused as never, 'staff-2'))
            .resolves.toEqual({ data: null, error: { code: '42501', message: 'STAFF_FORBIDDEN' } });
    });
});
