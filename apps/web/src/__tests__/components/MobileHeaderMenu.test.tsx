/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MobileHeaderMenu } from '@/app/_components/MobileHeaderMenu';
import type { ShellAccount } from '@/lib/shellAccount';
import { supabase } from '@/lib/supabaseClient';

let mockPathname = '/';

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({
        refresh: jest.fn(),
        push: jest.fn(),
    }),
}));

jest.mock('@/app/_components/RoleAndBusinessSwitcher', () => ({
    RoleAndBusinessSwitcher: () => null,
}));

// The account comes from the server (lib/shellViewer); opening the menu must not query identity.
jest.mock('@/lib/supabaseClient', () => ({
    supabase: { auth: { getUser: jest.fn(), signOut: jest.fn(), onAuthStateChange: jest.fn() }, from: jest.fn() },
}));

const staffAccount: ShellAccount = {
    userId: 'staff-1',
    label: 'Synthetic Master',
    roles: { hasDashboard: false, hasStaff: true, hasCabinet: true, hasAdmin: false },
};

describe('MobileHeaderMenu', () => {
    beforeEach(() => { mockPathname = '/'; jest.clearAllMocks(); });
    afterEach(() => {
        expect(supabase.auth.getUser).not.toHaveBeenCalled();
        expect(supabase.from).not.toHaveBeenCalled();
    });

    test('closes on navigation and does not restore an open menu when returning', () => {
        const { rerender } = render(<MobileHeaderMenu account={null} />);
        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        expect(screen.getByRole('button', { name: 'Меню', expanded: true })).toBeTruthy();

        mockPathname = '/catalog';
        rerender(<MobileHeaderMenu account={null} />);
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
        mockPathname = '/';
        rerender(<MobileHeaderMenu account={null} />);
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
    });

    test('closes immediately when the sign-in link is selected', async () => {
        render(<MobileHeaderMenu account={null} />);

        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        await waitFor(() => expect(screen.getByRole('link', { name: 'Войти' })).not.toBeNull());

        fireEvent.click(screen.getByRole('link', { name: 'Войти' }));

        expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Меню' }).getAttribute('aria-expanded')).toBe('false');
    });

    test('shows the server account with its staff cabinet, and a generic label without a name', () => {
        const { rerender } = render(<MobileHeaderMenu account={staffAccount} />);
        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        expect(screen.getByText('Synthetic Master')).toBeTruthy();
        expect(screen.queryByRole('link', { name: 'Войти' })).toBeNull();
        expect(document.body.textContent).toContain('Кабинет сотрудника');

        rerender(<MobileHeaderMenu account={{ ...staffAccount, label: null, roles: { ...staffAccount.roles, hasStaff: false } }} />);
        // The section heading and the nameless account label both read «Аккаунт»; the label is the bold one.
        expect(screen.getAllByText('Аккаунт').some(element => element.className.includes('font-medium'))).toBe(true);
        expect(document.body.textContent).not.toContain('Кабинет сотрудника');
    });
});
