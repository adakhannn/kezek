/** @jest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { RoleAndBusinessSwitcher } from '@/app/_components/RoleAndBusinessSwitcher';
import { supabase } from '@/lib/supabaseClient';

let pathname = '/dashboard';
const fetchMock = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: () => pathname,
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        auth: { getSession: jest.fn() },
        rpc: jest.fn(),
    },
}));

const mockedSupabase = supabase as unknown as {
    auth: { getSession: jest.Mock };
    rpc: jest.Mock;
};

describe('RoleAndBusinessSwitcher', () => {
    beforeEach(() => {
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
});
