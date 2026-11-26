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
                    whatsapp_phone: '+996555000111',
                    whatsapp_verified: true,
                    telegram_id: null,
                    telegram_username: null,
                    telegram_verified: false,
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

    function unverifiedProfile(extra: Record<string, unknown> = {}) {
        profileQuery.maybeSingle.mockResolvedValue({
            data: {
                id: 'test-user-id',
                full_name: 'Test User',
                phone: '+996555000111',
                notify_email: true,
                notify_whatsapp: true,
                notify_sms: false,
                notify_telegram: true,
                whatsapp_phone: null,
                whatsapp_verified: false,
                ...extra,
            },
            error: null,
        });
    }

    test('labels the e-mail through the dictionary', async () => {
        renderWithProviders(<ProfileScreen />);
        expect(await screen.findByText('test@example.com')).toBeTruthy();
        expect(screen.getByText('Email')).toBeTruthy();
    });

    // B5: WhatsApp notifications need a confirmed number, as on the website.
    test('an unconfirmed WhatsApp number locks the switch off, explains why and saves it off', async () => {
        unverifiedProfile();
        renderWithProviders(<ProfileScreen />);

        const whatsappSwitch = await screen.findByTestId('profile-whatsapp-switch');
        expect(whatsappSwitch.props.value).toBe(false);
        expect(whatsappSwitch.props.disabled).toBe(true);
        expect(screen.getByText('Сначала подтвердите номер WhatsApp ниже: без этого уведомления в WhatsApp не приходят.')).toBeTruthy();

        fireEvent.press(screen.getByText('Сохранить'));
        await waitFor(() => expect(savedBody()).toEqual(expect.objectContaining({ notify_whatsapp: false })));
    });

    test('confirms the WhatsApp number with a code through the web endpoints', async () => {
        unverifiedProfile();
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Подтвердить номер'));
        fireEvent.changeText(screen.getByTestId('whatsapp-phone-input'), '+996 555 123 456');
        fireEvent.press(screen.getByText('Отправить код'));

        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/whatsapp/send-otp', {
                method: 'POST',
                body: JSON.stringify({ phone: '+996 555 123 456' }),
            }),
        );
        expect(mockShowToast).toHaveBeenCalledWith('Код отправлен на WhatsApp', 'success');

        const reads = profileQuery.maybeSingle.mock.calls.length;
        fireEvent.changeText(await screen.findByTestId('whatsapp-code-input'), '12a3456');
        fireEvent.press(screen.getByText('Подтвердить'));

        await waitFor(() =>
            expect(mockedApiRequest).toHaveBeenCalledWith('/whatsapp/verify-otp', {
                method: 'POST',
                body: JSON.stringify({ code: '123456' }),
            }),
        );
        expect(mockShowToast).toHaveBeenCalledWith('Номер WhatsApp подтверждён', 'success');
        // The profile is read again: the switch unlocks with the server's whatsapp_verified.
        await waitFor(() => expect(profileQuery.maybeSingle.mock.calls.length).toBeGreaterThan(reads));
    });

    test('a short code is refused before any request', async () => {
        unverifiedProfile();
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Подтвердить номер'));
        fireEvent.press(screen.getByText('Отправить код'));
        fireEvent.changeText(await screen.findByTestId('whatsapp-code-input'), '123');
        fireEvent.press(screen.getByText('Подтвердить'));

        expect(await screen.findByText('Введите 6-значный код')).toBeTruthy();
        expect(mockedApiRequest).not.toHaveBeenCalledWith('/whatsapp/verify-otp', expect.anything());
    });

    // C12: Telegram state and linking on the website.
    test('shows the linked Telegram account', async () => {
        unverifiedProfile({ telegram_id: 42, telegram_username: 'aida', telegram_verified: true });
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Подключён: @aida')).toBeTruthy();
        expect(screen.queryByText('Привязать Telegram')).toBeNull();
    });

    test('links Telegram on the web profile, signed in through the handoff', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockImplementation(async (endpoint: string) =>
            endpoint === '/auth/web-handoff' ? { ok: true, url: 'https://kezek.vercel.app/auth/handoff?code=x' } : { ok: true });
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByText('Привязать Telegram'));

        await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://kezek.vercel.app/auth/handoff?code=x'));
        const handoff = mockedApiRequest.mock.calls.find(([endpoint]) => endpoint === '/auth/web-handoff');
        expect(JSON.parse(handoff?.[1].body as string)).toEqual({ next: '/cabinet/profile#telegram-connection' });
        openURL.mockRestore();
    });
});
