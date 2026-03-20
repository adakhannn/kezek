/**
 * Smoke test: ProfileScreen
 *
 * Проверяет базовый рендеринг экрана профиля и отображение данных пользователя.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import ProfileScreen from '../../screens/ProfileScreen';

jest.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: jest.fn(),
    }),
}));

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn().mockResolvedValue({ ok: true }),
}));

jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getUser: jest.fn().mockResolvedValue({
                data: {
                    user: {
                        id: 'test-user-id',
                        email: 'user@example.com',
                    },
                },
                error: null,
            }),
            signOut: jest.fn().mockResolvedValue({ error: null }),
        },
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
                data: {
                    id: 'test-user-id',
                    full_name: 'Алина',
                    phone: '+996500000001',
                    email: 'user@example.com',
                    notify_email: true,
                    notify_whatsapp: false,
                },
                error: null,
            }),
        })),
    },
}));

describe('ProfileScreen', () => {
    const createQueryClient = () =>
        new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

    const renderWithProviders = (component: React.ReactElement) => {
        return render(
            <QueryClientProvider client={createQueryClient()}>
                {component}
            </QueryClientProvider>,
        );
    };

    test('renders profile header and loaded user data', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('РџСЂРѕС„РёР»СЊ')).toBeTruthy();
        expect(await screen.findByDisplayValue('Алина')).toBeTruthy();
        expect(await screen.findByDisplayValue('+996500000001')).toBeTruthy();
        expect(await screen.findByText('user@example.com')).toBeTruthy();
    });
});
