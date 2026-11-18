import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { useUserRole } from '../../hooks/useUserRole';
import { supabase } from '../../lib/supabase';
import { supabaseQueryStub } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

const from = supabase.from as jest.Mock;

function mountHook() {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useUserRole(), { wrapper });
}

function mockCounts(counts: { businesses: number; staff: number; staffError?: Error }) {
    from.mockImplementation((table: string) => table === 'staff'
        ? supabaseQueryStub({ data: null, count: counts.staffError ? null : counts.staff, error: counts.staffError ?? null })
        : supabaseQueryStub({ data: null, count: counts.businesses, error: null }));
}

beforeEach(() => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: false, error: null });
    from.mockReset();
});

describe('useUserRole', () => {
    test('a master with active cards in two businesses is staff (ARCH-02)', async () => {
        mockCounts({ businesses: 0, staff: 2 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isStaff: true, isOwner: false, isSuperAdmin: false });
        const staffQuery = from.mock.results[from.mock.calls.findIndex(([table]) => table === 'staff')].value;
        expect(staffQuery.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
        expect(staffQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(staffQuery.eq).toHaveBeenCalledWith('is_active', true);
    });

    test('no active card is not staff', async () => {
        mockCounts({ businesses: 0, staff: 0 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.isStaff).toBe(false);
    });

    test('a failed staff check keeps the owner role', async () => {
        mockCounts({ businesses: 1, staff: 0, staffError: new Error('staff count failed') });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isOwner: true, isStaff: false, isSuperAdmin: false });
    });
});
