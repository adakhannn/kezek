import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';

import ProfileScreen from '../../screens/ProfileScreen';
import { supabase } from '../../lib/supabase';
import { createTestQueryClient } from '../testQueryClient';
import { apiRequest } from '../../lib/api';
import { Linking } from 'react-native';

const mockShowToast = jest.fn();

jest.mock('../../lib/api', () => ({
    apiRequest: jest.fn(),
}));

jest.mock('../../contexts/ToastContext', () => ({
    useToast: () => ({
        showToast: mockShowToast,
    }),
}));

const mockedApiRequest = apiRequest as jest.Mock;

function savedBody() {
    const call = mockedApiRequest.mock.calls.find(([endpoint]) => endpoint === '/profile/update');
    return call ? JSON.parse(call[1].body as string) : null;
}

describe('ProfileScreen', () => {
    const mockedSupabase = supabase as unknown as {
        auth: {
            getUser: jest.Mock;
            updateUser: jest.Mock;
        };
        from: jest.Mock;
    };
    let profileQuery: {
        select: jest.Mock;
        eq: jest.Mock;
        maybeSingle: jest.Mock;
        upsert: jest.Mock;
    };

    const renderWithProviders = (component: React.ReactElement) => {
        const queryClient = createTestQueryClient();

        return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
    };

    beforeEach(() => {
        mockShowToast.mockReset();
        mockedApiRequest.mockReset();
        mockedApiRequest.mockResolvedValue({ ok: true });

        mockedSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'test-user-id',
                    email: 'test@example.com',
                    phone: null,
                    user_metadata: {},
                },
            },
            error: null,
        });
        mockedSupabase.auth.updateUser.mockResolvedValue({
            data: {
                user: {
                    id: 'test-user-id',
                },
            },
            error: null,
        });

        profileQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    id: 'test-user-id',
                    full_name: 'Test User',
                    phone: '+996555000111',
                    notify_email: true,
                    notify_whatsapp: true,
                    notify_sms: false,
                    notify_telegram: true,
                },
                error: null,
            }),
            upsert: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };

        mockedSupabase.from.mockReturnValue(profileQuery);
    });

    afterEach(() => {
        mockedSupabase.auth.getUser.mockReset();
        mockedSupabase.auth.updateUser.mockReset();
        mockedSupabase.from.mockReset();
    });

    test('renders profile screen root', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByTestId('profile-screen')).toBeTruthy();
    });

    test('renders profile data and localized labels', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Профиль')).toBeTruthy();
        expect(await screen.findByDisplayValue('Test User')).toBeTruthy();
        expect(await screen.findByDisplayValue('+996555000111')).toBeTruthy();
        expect(await screen.findByText('Email нельзя изменить')).toBeTruthy();
    });

    test('saves profile updates with trimmed values', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('Test User'), '  Updated User  ');
        fireEvent.changeText(await screen.findByDisplayValue('+996555000111'), ' +996555222333 ');
        fireEvent.press(await screen.findByText('Сохранить'));

        await waitFor(() => {
            expect(mockedApiRequest).toHaveBeenCalledWith('/profile/update', expect.objectContaining({ method: 'POST' }));
        });
        expect(savedBody()).toEqual({
            full_name: 'Updated User',
            phone: '+996555222333',
            notify_email: true,
            notify_whatsapp: true,
            notify_sms: false,
            notify_telegram: true,
        });
        // Writes go through the server, never directly to profiles or Auth metadata.
        expect(profileQuery.upsert).not.toHaveBeenCalled();
        expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    test('saves disabled notification preferences through the profile API', async () => {
        renderWithProviders(<ProfileScreen />);

        await screen.findByText('Email уведомления');
        await screen.findByText('WhatsApp уведомления');

        const switches = screen.getAllByRole('switch');
        fireEvent(switches[0], 'valueChange', false);
        fireEvent(switches[1], 'valueChange', false);
        fireEvent.press(await screen.findByText('Сохранить'));

        await waitFor(() => {
            expect(savedBody()).toEqual(
                expect.objectContaining({
                    notify_email: false,
                    notify_whatsapp: false,
                }),
            );
        });
    });

    test('blocks save when full name is empty', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('Test User'), '   ');
        fireEvent.press(await screen.findByText('Сохранить'));

        expect(mockedApiRequest).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('Введите имя', 'error');
    });

    test('blocks save when phone format is invalid', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('+996555000111'), 'bad-phone');
        fireEvent.press(await screen.findByText('Сохранить'));

        expect(mockedApiRequest).not.toHaveBeenCalled();
        expect(mockShowToast).toHaveBeenCalledWith('Введите корректный номер телефона', 'error');
    });

    test('shows understandable error toast when profile update fails', async () => {
        mockedApiRequest.mockRejectedValueOnce(new Error('Server validation failed'));

        renderWithProviders(<ProfileScreen />);
        fireEvent.press(await screen.findByText('Сохранить'));

        await waitFor(() => {
            expect(mockShowToast).toHaveBeenCalledWith(
                'Не удалось обновить профиль. Попробуйте снова.',
                'error',
            );
        });
    });

    test('renders load error state', async () => {
        mockedSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: new Error('profile unavailable'),
            }),
        });

        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Не удалось загрузить профиль')).toBeTruthy();
        expect(await screen.findByText('Повторить')).toBeTruthy();
    });

    test('opens the privacy policy and terms on the website', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Политика конфиденциальности'));
        fireEvent.press(await screen.findByText('Условия использования'));

        await waitFor(() => expect(openURL).toHaveBeenCalledTimes(2));
        expect(openURL.mock.calls.map(([url]) => new URL(url).pathname)).toEqual(['/privacy', '/terms']);
        openURL.mockRestore();
    });

    test('starts account deletion in the app: opens the web profile signed in (R25-06)', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockImplementation(async (endpoint: string) =>
            endpoint === '/auth/web-handoff' ? { ok: true, url: 'https://kezek.vercel.app/auth/handoff?code=x' } : { ok: true });
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Удалить аккаунт'));

        await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://kezek.vercel.app/auth/handoff?code=x'));
        const handoff = mockedApiRequest.mock.calls.find(([endpoint]) => endpoint === '/auth/web-handoff');
        expect(JSON.parse(handoff?.[1].body as string)).toEqual({ next: '/cabinet/profile#account-deletion' });
        openURL.mockRestore();
    });

    test('never opens a non-handoff URL for account deletion', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockImplementation(async (endpoint: string) =>
            endpoint === '/auth/web-handoff' ? { ok: true, url: 'https://evil.example/phish' } : { ok: true });
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Удалить аккаунт'));

        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error'));
        expect(openURL).not.toHaveBeenCalled();
        openURL.mockRestore();
    });

    test('shows load error state when profile user request times out', async () => {
        jest.useFakeTimers();
        mockedSupabase.auth.getUser.mockReturnValueOnce(new Promise(() => undefined));

        try {
            renderWithProviders(<ProfileScreen />);

            await act(async () => {
                await jest.advanceTimersByTimeAsync(10000);
            });

            expect(await screen.findByText('Не удалось загрузить профиль')).toBeTruthy();
            expect(await screen.findByText('Повторить')).toBeTruthy();
        } finally {
            jest.useRealTimers();
        }
    });
});
