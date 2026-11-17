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

    test('keeps the refusal code so callers can answer not found', async () => {
        const refused = client({ data: null, error: { code: '42501', message: 'STAFF_FORBIDDEN', details: 'internal' } });
        await expect(readStaffPrivateFields(refused as never, 'staff-2'))
            .resolves.toEqual({ data: null, error: { code: '42501', message: 'STAFF_FORBIDDEN' } });
    });
});
