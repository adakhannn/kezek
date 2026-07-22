/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MobileHeaderMenu } from '@/app/_components/MobileHeaderMenu';

jest.mock('next/navigation', () => ({
    usePathname: () => '/',
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
    test('closes immediately when the sign-in link is selected', async () => {
        render(<MobileHeaderMenu />);

        fireEvent.click(screen.getByRole('button', { name: 'Меню' }));
        await waitFor(() => expect(screen.getByRole('link', { name: 'Войти' })).not.toBeNull());

        fireEvent.click(screen.getByRole('link', { name: 'Войти' }));

        expect(screen.queryByRole('button', { name: 'Закрыть' })).toBeNull();
        expect(screen.getByRole('button', { name: 'Меню' }).getAttribute('aria-expanded')).toBe('false');
    });
});
