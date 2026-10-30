/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { RoleAndBusinessSwitcher } from '@/app/_components/RoleAndBusinessSwitcher';
import { supabase } from '@/lib/supabaseClient';

let pathname = '/dashboard';
const fetchMock = jest.fn();
let mockAuthListener: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
const mockUnsubscribe = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: () => pathname,
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            onAuthStateChange: jest.fn((callback) => {
                mockAuthListener = callback;
                return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
            }),
        },
        rpc: jest.fn(),
    },
}));

const mockedSupabase = supabase as unknown as {
    auth: { getSession: jest.Mock };
    rpc: jest.Mock;
};

describe('RoleAndBusinessSwitcher', () => {
    beforeEach(() => {
        mockAuthListener = undefined;
        mockUnsubscribe.mockClear();
        pathname = '/dashboard';
        fetchMock.mockReset();
        global.fetch = fetchMock;
        window.localStorage.clear();
        document.cookie = 'kezek_lang=; max-age=0; path=/';
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');

        mockedSupabase.auth.getSession.mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
        });
        mockedSupabase.rpc.mockImplementation((name: string) => {
            if (name === 'is_super_admin') return Promise.resolve({ data: false });
            return Promise.resolve({ data: ['owner'] });
        });
        fetchMock.mockResolvedValue({
            ok: true,
            json: async () => ({
                ok: true,
                data: {
                    currentBizId: 'biz-1',
                    businesses: [{ id: 'biz-1' }, { id: 'biz-2' }],
                },
            }),
        });
    });

    it('switches cabinets without duplicating the business selector', async () => {
        render(
            <LanguageProvider>
                <RoleAndBusinessSwitcher />
            </LanguageProvider>,
        );

        const trigger = await screen.findByRole('button', { name: 'Business cabinet' });
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        fireEvent.click(trigger);

        expect(screen.getByText('Switch cabinet')).toBeTruthy();
        expect(screen.getByText('Cabinets')).toBeTruthy();
        expect(screen.queryByText('Businesses')).toBeNull();
        expect(screen.queryByText('Owner / manager')).toBeNull();
        expect(screen.queryByText('Тестовый бизнес 1')).toBeNull();

        const current = screen.getByRole('menuitem', { name: 'Business cabinet' });
        expect(current.getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('menuitem', { name: 'My bookings' })).toBeTruthy();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });

    it('shows the actual current cabinet instead of the highest available role', async () => {
        pathname = '/cabinet/bookings';

        render(
            <LanguageProvider>
                <RoleAndBusinessSwitcher />
            </LanguageProvider>,
        );

        expect(await screen.findByRole('button', { name: 'My bookings' })).toBeTruthy();
    });

    it('removes owner options and closes an open menu on account change without a remount', async () => {
        pathname = '/';
        render(<LanguageProvider><RoleAndBusinessSwitcher /></LanguageProvider>);
        fireEvent.click(await screen.findByRole('button', { name: 'Owner' }));
        expect(screen.getByRole('menuitem', { name: 'Business cabinet' })).toBeTruthy();
        mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'client' } } } });
        mockedSupabase.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'is_super_admin' ? false : [] }));
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { businesses: [] } }) });
        expect(mockAuthListener).toEqual(expect.any(Function));
        act(() => mockAuthListener!('SIGNED_IN', { user: { id: 'client' } }));
        expect(screen.queryByRole('menu')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Owner' })).toBeNull();
        fireEvent.click(await screen.findByRole('button', { name: 'Client' }));
        expect(screen.queryByRole('menuitem', { name: 'Business cabinet' })).toBeNull();
        expect(screen.getByRole('menuitem', { name: 'My bookings' })).toBeTruthy();
    });

    it('clears roles synchronously on signout and releases the subscription', async () => {
        pathname = '/';
        const { unmount } = render(<LanguageProvider><RoleAndBusinessSwitcher /></LanguageProvider>);
        await screen.findByRole('button', { name: 'Owner' });
        expect(mockAuthListener).toEqual(expect.any(Function));
        act(() => mockAuthListener!('SIGNED_OUT', null));
        expect(screen.queryByRole('button', { name: 'Owner' })).toBeNull();
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('does not publish a late owner response after a newer client session loads', async () => {
        pathname = '/';
        let resolveOldRoles!: (result: { data: string[] }) => void;
        const oldRoles = new Promise<{ data: string[] }>(resolve => { resolveOldRoles = resolve; });
        mockedSupabase.rpc.mockImplementation((name: string) => name === 'my_role_keys' ? oldRoles : Promise.resolve({ data: false }));
        render(<LanguageProvider><RoleAndBusinessSwitcher /></LanguageProvider>);
        await waitFor(() => expect(mockedSupabase.rpc).toHaveBeenCalledWith('my_role_keys'));
        mockedSupabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'client' } } } });
        mockedSupabase.rpc.mockImplementation((name: string) => Promise.resolve({ data: name === 'is_super_admin' ? false : [] }));
        fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { businesses: [] } }) });
        expect(mockAuthListener).toEqual(expect.any(Function));
        act(() => mockAuthListener!('SIGNED_IN', { user: { id: 'client' } }));
        await screen.findByRole('button', { name: 'Client' });
        await act(async () => resolveOldRoles({ data: ['owner'] }));
        expect(screen.queryByRole('button', { name: 'Owner' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Client' })).toBeTruthy();
    });
});
