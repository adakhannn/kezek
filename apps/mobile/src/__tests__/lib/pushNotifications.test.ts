import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

import { apiRequest } from '../../lib/api';
import {
    bookingUrlFromNotification,
    disablePushNotifications,
    enablePushNotifications,
    initialNotificationUrl,
    PUSH_SIGN_OUT_TIMEOUT_MS,
    readPushEnabled,
    readPushRegistration,
    subscribeToNotificationTaps,
    syncPushRegistration,
    unregisterPushTokenOnSignOut,
} from '../../lib/pushNotifications';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));

const TOKEN = 'ExponentPushToken[unit-test-install]';
const BOOKING_ID = '7d9f1c2e-3b4a-4c5d-8e6f-0a1b2c3d4e5f';
const store = new Map<string, string>();
const permission = (granted: boolean, canAskAgain = true) => ({ granted, canAskAgain, status: granted ? 'granted' : 'undetermined' }) as never;
const calls = (method: string) => jest.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === method);

beforeEach(() => {
    store.clear();
    jest.mocked(apiRequest).mockReset().mockResolvedValue({ registered: true });
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async key => store.get(key) ?? null);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (key, value) => { store.set(key, value); });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async key => { store.delete(key); });
    jest.mocked(Notifications.getPermissionsAsync).mockReset().mockResolvedValue(permission(false));
    jest.mocked(Notifications.requestPermissionsAsync).mockReset().mockResolvedValue(permission(true));
    jest.mocked(Notifications.getExpoPushTokenAsync).mockReset().mockResolvedValue({ type: 'expo', data: TOKEN });
    (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: { eas: { projectId: 'eas-project-id' } } };
});

afterEach(() => { jest.useRealTimers(); });

describe('the Profile switch', () => {
    test('on: asks for the permission once, gets the token with the EAS project id and registers it', async () => {
        await expect(enablePushNotifications('user-1')).resolves.toBe('enabled');
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'eas-project-id' });
        expect(calls('POST')).toEqual([['/api/mobile/push-tokens', expect.objectContaining({ method: 'POST' })]]);
        expect(JSON.parse(calls('POST')[0][1]!.body as string)).toEqual({ token: TOKEN, platform: 'ios', deviceName: 'Unit test phone' });
        expect(await readPushRegistration()).toEqual({ userId: 'user-1', token: TOKEN });
        jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(true));
        expect(await readPushEnabled('user-1')).toBe(true);
        expect(await readPushEnabled('user-2')).toBe(false);
    });

    test('on with the permission refused: nothing is registered', async () => {
        jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValue(permission(false, false));
        await expect(enablePushNotifications('user-1')).resolves.toBe('denied');
        jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(false, false));
        await expect(enablePushNotifications('user-1')).resolves.toBe('denied');
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(apiRequest).not.toHaveBeenCalled();
        expect(await readPushRegistration()).toBeNull();
    });

    test('on without an EAS project id is unsupported; a server error throws and leaves no record', async () => {
        (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: {} };
        await expect(enablePushNotifications('user-1')).resolves.toBe('unsupported');
        (Constants as unknown as { expoConfig: unknown }).expoConfig = { extra: { eas: { projectId: 'eas-project-id' } } };
        jest.mocked(apiRequest).mockRejectedValueOnce(new Error('HTTP 500'));
        await expect(enablePushNotifications('user-1')).rejects.toThrow('HTTP 500');
        expect(await readPushRegistration()).toBeNull();
    });

    test('off: removes the token on the server, forgets it and keeps the account from silent re-registration', async () => {
        await enablePushNotifications('user-1');
        await disablePushNotifications('user-1');
        expect(calls('DELETE')).toHaveLength(1);
        expect(JSON.parse(calls('DELETE')[0][1]!.body as string)).toEqual({ token: TOKEN });
        expect(await readPushRegistration()).toBeNull();
        jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(true));
        jest.mocked(apiRequest).mockClear();
        await syncPushRegistration('user-1');
        expect(apiRequest).not.toHaveBeenCalled();
        await syncPushRegistration('user-2');
        expect(calls('POST')).toHaveLength(1);
    });

    test('off fails when the server cannot remove the token, so the switch stays on', async () => {
        await enablePushNotifications('user-1');
        jest.mocked(apiRequest).mockRejectedValueOnce(new Error('offline'));
        await expect(disablePushNotifications('user-1')).rejects.toThrow('offline');
        expect(await readPushRegistration()).toEqual({ userId: 'user-1', token: TOKEN });
    });
});

describe('sign-in and sign-out', () => {
    test('sign-in never shows the permission dialog and registers only with a granted permission', async () => {
        await syncPushRegistration('user-1');
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
        expect(apiRequest).not.toHaveBeenCalled();
        jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(true));
        await syncPushRegistration('user-1');
        expect(calls('POST')).toHaveLength(1);
        expect(await readPushRegistration()).toEqual({ userId: 'user-1', token: TOKEN });
    });

    test('a registration failure at sign-in is logged, not thrown', async () => {
        jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue(permission(true));
        jest.mocked(apiRequest).mockRejectedValueOnce(new Error('offline'));
        await expect(syncPushRegistration('user-1')).resolves.toBeUndefined();
    });

    test('sign-out removes the registered token with a bounded wait and never throws', async () => {
        await unregisterPushTokenOnSignOut();
        expect(apiRequest).not.toHaveBeenCalled();
        await enablePushNotifications('user-1');
        jest.mocked(apiRequest).mockClear().mockRejectedValueOnce(new Error('offline'));
        await expect(unregisterPushTokenOnSignOut()).resolves.toBeUndefined();
        expect(calls('DELETE')[0][1]).toEqual(expect.objectContaining({ timeoutMs: PUSH_SIGN_OUT_TIMEOUT_MS }));

        jest.useFakeTimers();
        jest.mocked(apiRequest).mockImplementationOnce(() => new Promise(() => undefined));
        const pending = unregisterPushTokenOnSignOut();
        await jest.advanceTimersByTimeAsync(PUSH_SIGN_OUT_TIMEOUT_MS);
        await expect(pending).resolves.toBeUndefined();
    });
});

describe('a tapped notification opens the booking', () => {
    const response = (data: unknown) => ({ notification: { request: { content: { data } } } }) as never;

    test('bookingId becomes the booking link; anything else is ignored', () => {
        expect(bookingUrlFromNotification(response({ bookingId: BOOKING_ID, type: 'confirm' }))).toBe(`kezek://booking/${BOOKING_ID}`);
        expect(bookingUrlFromNotification(response({ bookingId: '../cabinet' }))).toBeNull();
        expect(bookingUrlFromNotification(response(null))).toBeNull();
        expect(bookingUrlFromNotification(null)).toBeNull();
    });

    test('cold start and running app', async () => {
        jest.mocked(Notifications.getLastNotificationResponseAsync).mockResolvedValueOnce(response({ bookingId: BOOKING_ID }));
        await expect(initialNotificationUrl()).resolves.toBe(`kezek://booking/${BOOKING_ID}`);
        const listener = jest.fn();
        const remove = jest.fn();
        let onTap: (value: unknown) => void = () => undefined;
        jest.mocked(Notifications.addNotificationResponseReceivedListener).mockImplementationOnce(callback => {
            onTap = callback as never;
            return { remove } as never;
        });
        const unsubscribe = subscribeToNotificationTaps(listener);
        onTap(response({ bookingId: BOOKING_ID }));
        onTap(response({}));
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(`kezek://booking/${BOOKING_ID}`);
        unsubscribe();
        expect(remove).toHaveBeenCalled();
    });
});
