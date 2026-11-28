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

const NOTIFY_EMAIL = { email: 'notify@example.com', verified: true, enabled: true, sources: ['google'] };

/** The profile's endpoints; `overrides` answers (or rejects) one endpoint differently. */
function apiAnswers(overrides: Record<string, unknown> = {}) {
    return async (endpoint: string) => {
        if (endpoint in overrides) {
            const answer = overrides[endpoint];
            if (answer instanceof Error) throw answer;
            return typeof answer === 'function' ? (answer as () => unknown)() : answer;
        }
        if (endpoint === '/profile/notification-emails') return { ok: true, data: [NOTIFY_EMAIL] };
        if (endpoint === '/account/deletion') return { ok: true, data: { request: null, blockers: [], eligible: true } };
        return { ok: true };
    };
}

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
        mockedApiRequest.mockImplementation(apiAnswers());

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

        // The navigation header carries "Профиль"; the screen opens with the person and sections.
        expect(await screen.findByText('Личная информация')).toBeTruthy();
        expect(screen.queryByText('Профиль')).toBeNull();
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
            // Telegram is not linked: its notifications are saved off, as the server would.
            notify_telegram: false,
            notification_emails: ['notify@example.com'],
        });
        // Writes go through the server, never directly to profiles or Auth metadata.
        expect(profileQuery.upsert).not.toHaveBeenCalled();
        expect(mockedSupabase.auth.updateUser).not.toHaveBeenCalled();
    });

    test('saves disabled notification preferences through the profile API', async () => {
        renderWithProviders(<ProfileScreen />);

        await screen.findByText('Уведомления по email');
        await screen.findByText('Уведомления в WhatsApp');

        fireEvent(screen.getByLabelText('Уведомления по email'), 'valueChange', false);
        fireEvent(screen.getByTestId('profile-whatsapp-switch'), 'valueChange', false);
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

        expect(savedBody()).toBeNull();
        expect(mockShowToast).toHaveBeenCalledWith('Введите имя', 'error');
    });

    test('blocks save when phone format is invalid', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent.changeText(await screen.findByDisplayValue('+996555000111'), 'bad-phone');
        fireEvent.press(await screen.findByText('Сохранить'));

        expect(savedBody()).toBeNull();
        expect(mockShowToast).toHaveBeenCalledWith('Введите корректный номер телефона', 'error');
    });

    test('shows understandable error toast when profile update fails', async () => {
        mockedApiRequest.mockImplementation(apiAnswers({ '/profile/update': new Error('Server validation failed') }));

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

    const deletionCalls = (method: string) =>
        mockedApiRequest.mock.calls.filter(([endpoint, init]) => endpoint === '/account/deletion' && init?.method === method);

    // App Store 5.1.1(v): deletion runs in the app, as the website's AccountDeletionPanel.
    test('requests account deletion in the app only with the typed phrase', async () => {
        renderWithProviders(<ProfileScreen />);

        const confirmation = await screen.findByTestId('account-deletion-confirmation');
        fireEvent.press(screen.getByText('Запросить удаление аккаунта'));
        expect(deletionCalls('POST')).toHaveLength(0);

        fireEvent.changeText(confirmation, 'УДАЛИТЬ');
        fireEvent.press(screen.getByText('Запросить удаление аккаунта'));

        await waitFor(() => expect(deletionCalls('POST')).toHaveLength(1));
        expect(JSON.parse(deletionCalls('POST')[0][1].body as string)).toEqual({ confirmation: 'УДАЛИТЬ' });
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Удаление аккаунта запрошено', 'success'));
    });

    test('shows what blocks deletion and no request form', async () => {
        mockedApiRequest.mockImplementation(apiAnswers({
            '/account/deletion': { ok: true, data: { request: null, eligible: false, blockers: [{ code: 'owned_businesses', message: 'x', count: 2 }] } },
        }));
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('• Сначала передайте владение или закройте все принадлежащие вам бизнесы (2)')).toBeTruthy();
        expect(screen.queryByTestId('account-deletion-confirmation')).toBeNull();
        expect(screen.queryByText('Запросить удаление аккаунта')).toBeNull();
        expect(deletionCalls('POST')).toHaveLength(0);
    });

    test('a pending deletion can be cancelled', async () => {
        mockedApiRequest.mockImplementation(apiAnswers({
            '/account/deletion': { ok: true, data: { eligible: true, blockers: [], request: { status: 'pending', requested_at: '2026-11-20T10:00:00Z', scheduled_for: '2026-11-27T10:00:00Z' } } },
        }));
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Аккаунт ожидает удаления')).toBeTruthy();
        fireEvent.press(screen.getByText('Отменить удаление'));
        await waitFor(() => expect(deletionCalls('DELETE')).toHaveLength(1));
    });

    test('Yandex is linked on the web profile, opened signed in; never a non-handoff URL', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockImplementation(apiAnswers({ '/auth/web-handoff': { ok: true, url: 'https://evil.example/phish' } }));
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByLabelText('Подключить Яндекс'));

        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'error'));
        const handoff = mockedApiRequest.mock.calls.find(([endpoint]) => endpoint === '/auth/web-handoff');
        expect(JSON.parse(handoff?.[1].body as string)).toEqual({ next: '/cabinet/profile' });
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
        expect(screen.queryByLabelText('Подключить Telegram')).toBeNull();
        expect(screen.getByLabelText('Отвязать Telegram')).toBeTruthy();
    });

    const profileLinkCalls = (action: string) => mockedApiRequest.mock.calls.filter(([endpoint, init]) =>
        endpoint === '/auth/telegram/profile-link' && JSON.parse(String(init?.body ?? '{}')).action === action);

    test('links Telegram natively through the bot: open the bot, check the account, link it', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        const token = 'a'.repeat(32);
        mockedApiRequest.mockImplementation(apiAnswers({
            '/auth/telegram/profile-link': () => {
                const action = JSON.parse(String(mockedApiRequest.mock.calls.at(-1)?.[1]?.body)).action;
                if (action === 'create') return { ok: true, data: { token, expiresAt: '2999-01-01T00:00:00Z', botDeepLink: `https://t.me/kezek_bot?start=kl1_${token}` } };
                if (action === 'status') return { ok: true, data: { status: 'approved', account: { id: 777, name: 'Aida', username: 'aida' } } };
                return { ok: true, data: { status: 'consumed' } };
            },
        }));
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByLabelText('Подключить Telegram'));
        expect(await screen.findByTestId('telegram-link-sheet')).toBeTruthy();
        expect(await screen.findByText('Aida')).toBeTruthy();
        expect(screen.getByText('ID: 777')).toBeTruthy();

        fireEvent.press(screen.getByText('Подключить этот аккаунт'));
        await waitFor(() => expect(profileLinkCalls('finish')).toHaveLength(1));
        expect(JSON.parse(String(profileLinkCalls('finish')[0][1].body))).toEqual({ action: 'finish', token, telegramId: 777 });
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Telegram успешно подключён!', 'success'));
        openURL.mockRestore();
    });

    test('opens the bot from the sheet while the link waits for confirmation', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        const token = 'b'.repeat(32);
        mockedApiRequest.mockImplementation(apiAnswers({
            '/auth/telegram/profile-link': () => {
                const action = JSON.parse(String(mockedApiRequest.mock.calls.at(-1)?.[1]?.body)).action;
                if (action === 'create') return { ok: true, data: { token, expiresAt: '2999-01-01T00:00:00Z', botDeepLink: `https://t.me/kezek_bot?start=kl1_${token}` } };
                return { ok: true, data: { status: 'pending' } };
            },
        }));
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByLabelText('Подключить Telegram'));
        fireEvent.press(await screen.findByText('Открыть бота в Telegram'));
        await waitFor(() => expect(openURL).toHaveBeenCalledWith(`https://t.me/kezek_bot?start=kl1_${token}`));
        openURL.mockRestore();
    });

    test('links Telegram on the web profile when the bot link is off on the server', async () => {
        const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
        mockedApiRequest.mockImplementation(apiAnswers({
            '/auth/telegram/profile-link': Object.assign(new Error('off'), { status: 503 }),
            '/auth/web-handoff': { ok: true, url: 'https://kezek.vercel.app/auth/handoff?code=x' },
        }));
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByLabelText('Подключить Telegram'));

        await waitFor(() => expect(openURL).toHaveBeenCalledWith('https://kezek.vercel.app/auth/handoff?code=x'));
        const handoff = mockedApiRequest.mock.calls.find(([endpoint]) => endpoint === '/auth/web-handoff');
        expect(JSON.parse(handoff?.[1].body as string)).toEqual({ next: '/cabinet/profile#telegram-connection' });
        openURL.mockRestore();
    });

    test('Telegram notifications follow the link: locked off when not linked, saved when linked', async () => {
        renderWithProviders(<ProfileScreen />);
        const locked = await screen.findByTestId('profile-telegram-switch');
        expect(locked.props.disabled).toBe(true);
        expect(screen.getByText('Сначала подключите Telegram в разделе способов входа.')).toBeTruthy();
    });

    test('a linked Telegram can be switched off for notifications', async () => {
        unverifiedProfile({ telegram_id: 42, telegram_username: 'aida', telegram_verified: true });
        renderWithProviders(<ProfileScreen />);

        const telegramSwitch = await screen.findByTestId('profile-telegram-switch');
        expect(telegramSwitch.props.value).toBe(true);
        fireEvent(telegramSwitch, 'valueChange', false);
        fireEvent.press(screen.getByText('Сохранить'));
        await waitFor(() => expect(savedBody()).toEqual(expect.objectContaining({ notify_telegram: false })));
    });

    test('e-mail notifications need at least one chosen address, as on the website', async () => {
        renderWithProviders(<ProfileScreen />);

        fireEvent(await screen.findByLabelText('notify@example.com'), 'valueChange', false);
        fireEvent.press(screen.getByText('Сохранить'));

        expect(mockShowToast).toHaveBeenCalledWith('Выберите хотя бы один адрес для email-уведомлений', 'error');
        expect(savedBody()).toBeNull();
    });

    test('a notification address list that failed to load is neither required nor sent', async () => {
        mockedApiRequest.mockImplementation(apiAnswers({ '/profile/notification-emails': new Error('down') }));
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByText('Не удалось загрузить адреса для уведомлений.')).toBeTruthy();
        fireEvent.press(screen.getByText('Сохранить'));
        await waitFor(() => expect(savedBody()).not.toBeNull());
        expect(savedBody()).not.toHaveProperty('notification_emails');
    });

    test('unlinks a sign-in method through the web endpoint', async () => {
        mockedSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'test@example.com', phone: null, user_metadata: {}, app_metadata: { providers: ['google'] } } },
            error: null,
        });
        renderWithProviders(<ProfileScreen />);

        fireEvent.press(await screen.findByLabelText('Отвязать Google'));

        await waitFor(() => expect(mockedApiRequest).toHaveBeenCalledWith('/auth/connections/unlink', {
            method: 'POST',
            body: JSON.stringify({ provider: 'google' }),
        }));
        await waitFor(() => expect(mockShowToast).toHaveBeenCalledWith('Способ входа успешно отвязан', 'success'));
    });

    test('Sign in with Apple is a read-only connected row; Google beside it stays unlinkable', async () => {
        mockedSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'test-user-id', email: 'relay@privaterelay.appleid.com', phone: null, user_metadata: {}, identities: [{ provider: 'apple' }, { provider: 'google' }] } },
            error: null,
        });
        renderWithProviders(<ProfileScreen />);

        const apple = await screen.findByTestId('profile-apple-connection');
        expect(apple).toBeTruthy();
        expect(screen.getByText('Apple')).toBeTruthy();
        expect(screen.getByText('Вход через Apple отключается в настройках Apple ID на устройстве.')).toBeTruthy();
        expect(screen.queryByLabelText('Отвязать Apple')).toBeNull();
        expect(screen.getByLabelText('Отвязать Google')).toBeTruthy();
    });

    test('no Apple row for an account without Sign in with Apple', async () => {
        renderWithProviders(<ProfileScreen />);

        expect(await screen.findByTestId('profile-google-connection')).toBeTruthy();
        expect(screen.queryByTestId('profile-apple-connection')).toBeNull();
    });
});
