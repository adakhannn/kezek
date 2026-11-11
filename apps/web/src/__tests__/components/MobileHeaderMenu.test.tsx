/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MobileHeaderMenu } from '@/app/_components/MobileHeaderMenu';

let mockPathname = '/';

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useRouter: () => ({
        refresh: jest.fn(),
    }),
}));

jest.mock('@/app/_components/RoleAndBusinessSwitcher', () => ({
    RoleAndBusinessSwitcher: () => null,
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
    },
}));

describe('MobileHeaderMenu', () => {
    beforeEach(() => { mockPathname = '/'; });

    test('closes on navigation and does not restore an open menu when returning', () => {
        const { rerender } = render(<MobileHeaderMenu />);
        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        expect(screen.getByRole('button', { name: 'Меню', expanded: true })).toBeTruthy();

        mockPathname = '/catalog';
        rerender(<MobileHeaderMenu />);
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
        mockPathname = '/';
        rerender(<MobileHeaderMenu />);
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Меню', expanded: false })).toBeTruthy();
    });

    test('closes immediately when the sign-in link is selected', async () => {
        render(<MobileHeaderMenu />);

        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        await waitFor(() => expect(screen.getByRole('link', { name: 'Войти' })).not.toBeNull());

        fireEvent.click(screen.getByRole('link', { name: 'Войти' }));

        expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Меню' }).getAttribute('aria-expanded')).toBe('false');
    });
});
