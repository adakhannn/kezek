import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import { useUserRole } from '../../hooks/useUserRole';
import { logWarn } from '../../lib/log';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/log', () => ({ ...jest.requireActual('../../lib/log'), logWarn: jest.fn() }));

const from = supabase.from as jest.Mock;
const rpc = supabase.rpc as jest.Mock;

type Result = { data: unknown; error: Error | null; count?: number | null };

/** An awaited query builder: every filter returns it, awaiting it yields the result. */
function query(result: Result) {
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'not', 'in', 'order']) builder[method] = jest.fn(() => builder);
    builder.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
    return builder as Record<'select' | 'eq' | 'not' | 'in' | 'order', jest.Mock>;
}

function mountHook() {
    const client = createTestQueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return renderHook(() => useUserRole(), { wrapper });
}

type Setup = {
    businesses?: number;
    staff?: number;
    staffError?: Error;
    ownerError?: Error;
    roleRows?: Array<{ biz_id: string; role_id: number }>;
    roleKeys?: Array<{ id: number; key: string }>;
    rolesError?: Error;
};

function mockTables(setup: Setup) {
    from.mockImplementation((table: string) => {
        if (table === 'staff') return query({ data: null, count: setup.staffError ? null : setup.staff ?? 0, error: setup.staffError ?? null });
        if (table === 'businesses') return query({ data: null, count: setup.ownerError ? null : setup.businesses ?? 0, error: setup.ownerError ?? null });
        if (table === 'user_roles') return query({ data: setup.rolesError ? null : setup.roleRows ?? [], error: setup.rolesError ?? null });
        if (table === 'roles') return query({ data: setup.roleKeys ?? [], error: null });
        throw new Error(`unexpected table ${table}`);
    });
}

const KEYS = [{ id: 1, key: 'owner' }, { id: 2, key: 'admin' }, { id: 3, key: 'manager' }, { id: 4, key: 'staff' }];

beforeEach(() => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    rpc.mockResolvedValue({ data: false, error: null });
    from.mockReset();
    jest.mocked(logWarn).mockClear();
});

describe('useUserRole', () => {
    test('a master with active cards in two businesses is staff (ARCH-02)', async () => {
        mockTables({ staff: 2 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isStaff: true, isOwner: false, isBusinessManager: false, isSuperAdmin: false });
        const staffQuery = from.mock.results[from.mock.calls.findIndex(([table]) => table === 'staff')].value;
        expect(staffQuery.select).toHaveBeenCalledWith('id', { count: 'exact', head: true });
        expect(staffQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(staffQuery.eq).toHaveBeenCalledWith('is_active', true);
    });

    test('no active card is not staff', async () => {
        mockTables({ staff: 0 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.isStaff).toBe(false);
    });

    test('a failed staff check keeps the owner role', async () => {
        mockTables({ businesses: 1, staffError: new Error('staff count failed') });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isOwner: true, isBusinessManager: true, isStaff: false, isSuperAdmin: false });
    });

    test.each([['admin', 2], ['manager', 3], ['owner', 1]])('a user_roles %s of a business is a business manager (O3/B10)', async (_key, roleId) => {
        mockTables({ roleRows: [{ biz_id: 'biz-1', role_id: roleId }], roleKeys: KEYS });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isOwner: false, isBusinessManager: true });
        const rolesQuery = from.mock.results[from.mock.calls.findIndex(([table]) => table === 'user_roles')].value;
        expect(rolesQuery.eq).toHaveBeenCalledWith('user_id', 'user-1');
        expect(rolesQuery.not).toHaveBeenCalledWith('biz_id', 'is', null);
    });

    test('a staff role alone opens no Business tab', async () => {
        mockTables({ staff: 1, roleRows: [{ biz_id: 'biz-1', role_id: 4 }], roleKeys: KEYS });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isBusinessManager: false, isStaff: true });
    });

    test('a super admin gets the tabs of their own roles, not every tab (O3)', async () => {
        rpc.mockResolvedValue({ data: true, error: null });
        mockTables({ staff: 1 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isSuperAdmin: true, isOwner: false, isBusinessManager: false, isStaff: true });
    });

    test('a failed super admin check is logged, not ignored, and the other roles still load', async () => {
        rpc.mockResolvedValue({ data: null, error: new Error('rpc down') });
        mockTables({ businesses: 1, staff: 1 });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isSuperAdmin: false, isOwner: true, isStaff: true });
        expect(logWarn).toHaveBeenCalledWith('useUserRole', 'Super admin check failed', { message: 'rpc down' });
    });

    test('a failed role read keeps the staff role and is logged', async () => {
        mockTables({ staff: 1, rolesError: new Error('roles down') });
        const { result } = mountHook();

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toMatchObject({ isBusinessManager: false, isStaff: true });
        expect(logWarn).toHaveBeenCalledWith('useUserRole', 'Manager role check failed', { message: 'roles down' });
    });
});
