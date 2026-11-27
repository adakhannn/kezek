/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { RoleAndBusinessSwitcher } from '@/app/_components/RoleAndBusinessSwitcher';
import type { ShellAccount } from '@/lib/shellAccount';
import { supabase } from '@/lib/supabaseClient';

let pathname = '/dashboard';
let mockAuthListener: ((event: string, session: { user: { id: string } } | null) => void) | undefined;
const mockUnsubscribe = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: () => pathname,
}));

// The switcher renders what the server read (lib/shellViewer); it must not query identity itself.
jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            getUser: jest.fn(),
            onAuthStateChange: jest.fn((callback) => {
                mockAuthListener = callback;
                return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
            }),
        },
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

const owner: ShellAccount = {
    userId: 'owner-1',
    label: 'Owner Name',
    roles: { hasDashboard: true, hasStaff: false, hasCabinet: true, hasAdmin: false },
};
const client: ShellAccount = {
    userId: 'client-1',
    label: null,
    roles: { hasDashboard: false, hasStaff: false, hasCabinet: true, hasAdmin: false },
};

function renderSwitcher(account: ShellAccount | null) {
    return render(
        <LanguageProvider>
            <RoleAndBusinessSwitcher key={account?.userId ?? 'anonymous'} account={account} />
        </LanguageProvider>,
    );
}

describe('RoleAndBusinessSwitcher', () => {
    beforeEach(() => {
        mockAuthListener = undefined;
        mockUnsubscribe.mockClear();
        pathname = '/dashboard';
        window.localStorage.clear();
        document.cookie = 'kezek_lang=; max-age=0; path=/';
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    afterEach(() => {
        expect(supabase.auth.getSession).not.toHaveBeenCalled();
        expect(supabase.auth.getUser).not.toHaveBeenCalled();
        expect(supabase.rpc).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('switches cabinets without duplicating the business selector', async () => {
        renderSwitcher(owner);

        const trigger = await screen.findByRole('button', { name: 'Business dashboard' });
        expect(trigger.getAttribute('aria-haspopup')).toBe('menu');
        fireEvent.click(trigger);

        expect(screen.getByText('Switch workspace')).toBeTruthy();
        expect(screen.getByText('Workspaces')).toBeTruthy();
        expect(screen.queryByText('Businesses')).toBeNull();
        expect(screen.queryByText('Owner / manager')).toBeNull();

        const current = screen.getByRole('menuitem', { name: 'Business dashboard' });
        expect(current.getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('menuitem', { name: 'My bookings' })).toBeTruthy();

        fireEvent.keyDown(document, { key: 'Escape' });
        await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    });

    it('shows the actual current cabinet instead of the highest available role', async () => {
        pathname = '/cabinet/bookings';
        renderSwitcher(owner);
        expect(await screen.findByRole('button', { name: 'My bookings' })).toBeTruthy();
    });

    it('hides the owner cabinets and closes an open menu as soon as another account signs in', async () => {
        pathname = '/';
        const { rerender } = renderSwitcher(owner);
        fireEvent.click(await screen.findByRole('button', { name: 'Owner' }));
        expect(screen.getByRole('menuitem', { name: 'Business dashboard' })).toBeTruthy();

        expect(mockAuthListener).toEqual(expect.any(Function));
        act(() => mockAuthListener!('SIGNED_IN', { user: { id: 'client-1' } }));
        expect(screen.queryByRole('menu')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Owner' })).toBeNull();

        // The header refresh then renders the switcher for the new account.
        rerender(
            <LanguageProvider>
                <RoleAndBusinessSwitcher key={client.userId} account={client} />
            </LanguageProvider>,
        );
        fireEvent.click(await screen.findByRole('button', { name: 'Client' }));
        expect(screen.queryByRole('menuitem', { name: 'Business dashboard' })).toBeNull();
        expect(screen.getByRole('menuitem', { name: 'My bookings' })).toBeTruthy();
    });

    it('clears the cabinets synchronously on sign-out and releases the subscription', async () => {
        pathname = '/';
        const { unmount } = renderSwitcher(owner);
        await screen.findByRole('button', { name: 'Owner' });
        act(() => mockAuthListener!('SIGNED_OUT', null));
        expect(screen.queryByRole('button', { name: 'Owner' })).toBeNull();
        unmount();
        expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('keeps the menu for token refreshes and repeated sign-in events of the same account', async () => {
        pathname = '/';
        renderSwitcher(owner);
        await screen.findByRole('button', { name: 'Owner' });
        act(() => mockAuthListener!('TOKEN_REFRESHED', { user: { id: 'owner-1' } }));
        act(() => mockAuthListener!('SIGNED_IN', { user: { id: 'owner-1' } }));
        expect(screen.getByRole('button', { name: 'Owner' })).toBeTruthy();
    });

    it('renders nothing and subscribes to nothing when signed out', () => {
        const { container } = renderSwitcher(null);
        expect(container.textContent).toBe('');
        expect(mockAuthListener).toBeUndefined();
    });
});
