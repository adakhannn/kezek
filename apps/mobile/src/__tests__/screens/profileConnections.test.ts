import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../../lib/supabase';
import { linkGoogleIdentity } from '../../screens/profile/profileApi';
import {
    deriveLoginConnections,
    isTelegramAttemptExpired,
    isTelegramBotLink,
    notificationEmailSourceLabel,
    notificationEmailsBlockSave,
    parseNotificationEmails,
    selectedNotificationEmails,
    telegramPollDelay,
    toggleNotificationEmail,
} from '../../screens/profile/profileConnections';

jest.mock('../../navigation/useRootNavigationSession', () => ({ handleDeepLinkAuth: jest.fn(async () => true) }));

describe('deriveLoginConnections (web ProfileForm rules)', () => {
    test('Google from Auth providers or identities', () => {
        expect(deriveLoginConnections({ app_metadata: { providers: ['google'] } }, null).google).toBe(true);
        expect(deriveLoginConnections({ identities: [{ provider: 'google' }] }, null).google).toBe(true);
        expect(deriveLoginConnections({ app_metadata: { provider: 'email' } }, null).google).toBe(false);
    });

    test('Yandex from the profile id, the metadata or the sign-in provider', () => {
        expect(deriveLoginConnections(null, { yandex_id: '1' }).yandex).toBe(true);
        expect(deriveLoginConnections({ user_metadata: { auth_provider: 'yandex' } }, null).yandex).toBe(true);
        expect(deriveLoginConnections({ user_metadata: { yandex_id: 5 } }, null).yandex).toBe(true);
        expect(deriveLoginConnections({}, {}).yandex).toBe(false);
    });

    test('Telegram needs a verified profile id or the sign-in metadata; WhatsApp a verified number', () => {
        expect(deriveLoginConnections(null, { telegram_id: 1, telegram_verified: false }).telegram).toBe(false);
        expect(deriveLoginConnections(null, { telegram_id: 1, telegram_verified: true }).telegram).toBe(true);
        expect(deriveLoginConnections({ user_metadata: { telegram_id: 9 } }, null).telegram).toBe(true);
        expect(deriveLoginConnections(null, { whatsapp_verified: true }).whatsapp).toBe(true);
    });
});

describe('notification e-mail addresses', () => {
    const items = parseNotificationEmails([
        { email: 'a@x.kg', verified: true, enabled: true, sources: ['google'] },
        { email: 'b@x.kg', verified: false, enabled: true, sources: ['yandex', 7] },
        { email: '', verified: true, enabled: true },
        'junk',
    ]);

    test('keeps well-formed rows only', () => {
        expect(items.map((item) => item.email)).toEqual(['a@x.kg', 'b@x.kg']);
        expect(items[1].sources).toEqual(['yandex']);
        expect(parseNotificationEmails(null)).toEqual([]);
    });

    test('only enabled and verified addresses are selected', () => {
        expect(selectedNotificationEmails(items)).toEqual(['a@x.kg']);
        expect(selectedNotificationEmails(toggleNotificationEmail(items, 'a@x.kg', false))).toEqual([]);
    });

    test('e-mail notifications on need a chosen address once the list is known', () => {
        const none = toggleNotificationEmail(items, 'a@x.kg', false);
        expect(notificationEmailsBlockSave(true, true, none)).toBe(true);
        expect(notificationEmailsBlockSave(false, true, none)).toBe(false);
        expect(notificationEmailsBlockSave(true, false, none)).toBe(false);
        expect(notificationEmailsBlockSave(true, true, items)).toBe(false);
    });

    test('source label', () => {
        expect(notificationEmailSourceLabel(['google', 'primary'], { google: 'Google', yandex: 'Яндекс', primary: 'Основной' }))
            .toBe('Google · Основной');
    });
});

describe('Telegram bot link', () => {
    test('poll backs off from 3 s to at most 15 s', () => {
        expect(telegramPollDelay(0)).toBe(3000);
        expect(telegramPollDelay(1)).toBe(6000);
        expect(telegramPollDelay(5)).toBe(15000);
    });

    test('expiry and accepted links', () => {
        expect(isTelegramAttemptExpired({ token: 't', botDeepLink: '', expiresAt: '2000-01-01T00:00:00Z' })).toBe(true);
        expect(isTelegramAttemptExpired({ token: 't', botDeepLink: '', expiresAt: '2999-01-01T00:00:00Z' })).toBe(false);
        expect(isTelegramBotLink('https://t.me/kezek_bot?start=kl1_x')).toBe(true);
        expect(isTelegramBotLink('https://evil.example/t.me')).toBe(false);
        expect(isTelegramBotLink('http://t.me/x')).toBe(false);
    });
});

describe('linkGoogleIdentity', () => {
    const auth = supabase.auth as unknown as { linkIdentity?: jest.Mock; getUser: jest.Mock };

    beforeEach(() => {
        auth.linkIdentity = jest.fn().mockResolvedValue({ data: { provider: 'google', url: 'https://accounts.example/consent' }, error: null });
    });

    test('opens the consent page in an auth session and confirms the identity with Auth', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: 'kezek://auth/callback?code=abc' });
        auth.getUser.mockResolvedValue({ data: { user: { identities: [{ provider: 'google' }] } }, error: null });

        await expect(linkGoogleIdentity()).resolves.toBe('linked');
        expect(auth.linkIdentity).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'google',
            options: expect.objectContaining({ skipBrowserRedirect: true, redirectTo: 'kezek://auth/callback' }),
        }));
        expect(WebBrowser.openAuthSessionAsync).toHaveBeenCalledWith('https://accounts.example/consent', 'kezek://auth/callback');
    });

    test('a closed page is a cancellation, an OAuth error is thrown', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'cancel' });
        await expect(linkGoogleIdentity()).resolves.toBe('cancelled');

        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: 'kezek://auth/callback?error_description=Identity+already+linked' });
        await expect(linkGoogleIdentity()).rejects.toThrow('Identity already linked');
    });

    test('fails when Auth does not show the linked identity', async () => {
        (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({ type: 'success', url: 'kezek://auth/callback?code=abc' });
        auth.getUser.mockResolvedValue({ data: { user: { identities: [] } }, error: null });
        await expect(linkGoogleIdentity()).rejects.toThrow('Google was not linked');
    });
});
