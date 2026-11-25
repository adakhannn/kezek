import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { apiRequest } from './api';
import { logWarn } from './log';

/**
 * Booking push notifications (confirmation, cancellation, reminders 24 h and 2 h before the visit).
 *
 * When the app asks for permission: only from the Profile switch "Push-уведомления", never on its
 * own. The system dialog appears once per install on iOS, so it is shown when the person has just
 * asked for push and knows why, not on a cold start before they did anything. After that:
 * - a sign-in (or another account) on an install that already has the OS permission registers the
 *   token silently, unless that account turned the switch off on this install;
 * - the switch off and the sign-out button remove the token on the server (DELETE, best effort);
 * - a session that ended without the button only drops the local record (no session to call with).
 *
 * The server keeps one row per token (POST /api/mobile/push-tokens), so registering the token for a
 * new account moves it away from the previous one. The token is never logged.
 */

const REGISTRATION_KEY = 'kezek.push.registration';
const optOutKey = (userId: string) => `kezek.push.off.${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;
const ENDPOINT = '/api/mobile/push-tokens';
export const PUSH_SIGN_OUT_TIMEOUT_MS = 3000;
const ANDROID_CHANNEL_ID = 'default';

export type PushRegistration = { userId: string; token: string };
export type EnablePushResult = 'enabled' | 'denied' | 'unsupported';

type RequestWithTimeout = RequestInit & { timeoutMs?: number };

export async function readPushRegistration(): Promise<PushRegistration | null> {
    try {
        const raw = await SecureStore.getItemAsync(REGISTRATION_KEY);
        if (!raw) return null;
        const value = JSON.parse(raw) as Partial<PushRegistration>;
        return typeof value.userId === 'string' && typeof value.token === 'string' ? { userId: value.userId, token: value.token } : null;
    } catch {
        return null;
    }
}

/** The local record only; the server row stays (used when the session ended without the button). */
export async function clearPushRegistrationRecord(): Promise<void> {
    await SecureStore.deleteItemAsync(REGISTRATION_KEY);
}

/** Whether the Profile switch is on: this install registered its token for this account. */
export async function isPushEnabledFor(userId: string): Promise<boolean> {
    return (await readPushRegistration())?.userId === userId;
}

/** Notifications arriving while the app is open are shown too. Called once at start. */
export function configureNotificationPresentation(): void {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

function easProjectId(): string | undefined {
    const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
    return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

async function ensureAndroidChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Kezek',
        importance: Notifications.AndroidImportance.HIGH,
    });
}

async function currentToken(): Promise<string | null> {
    const projectId = easProjectId();
    if (!projectId) return null;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return typeof data === 'string' && data ? data : null;
}

async function registerToken(userId: string, token: string): Promise<void> {
    await apiRequest(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android', deviceName: Device.deviceName ?? null }),
    });
    await SecureStore.setItemAsync(REGISTRATION_KEY, JSON.stringify({ userId, token } satisfies PushRegistration));
}

/**
 * The Profile switch turned on: asks for the OS permission if it was never answered, then
 * registers the token. Throws when the server could not save it (the switch stays off).
 */
export async function enablePushNotifications(userId: string): Promise<EnablePushResult> {
    if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return 'unsupported';
    await ensureAndroidChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.canAskAgain) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'denied';
    const token = await currentToken();
    if (!token) return 'unsupported';
    await registerToken(userId, token);
    await SecureStore.deleteItemAsync(optOutKey(userId));
    return 'enabled';
}

/**
 * The Profile switch turned off: removes the token on the server first, so a failure leaves the
 * switch on instead of pretending push stopped. The account's choice is remembered on this install.
 */
export async function disablePushNotifications(userId: string): Promise<void> {
    // Without a local record (cleared when an earlier session ended) the server may still hold
    // this install's token for the account: it is read again when the permission allows.
    const token = (await readPushRegistration())?.token ?? await tokenIfPermitted();
    if (token) await apiRequest(ENDPOINT, { method: 'DELETE', body: JSON.stringify({ token }) });
    await clearPushRegistrationRecord();
    await SecureStore.setItemAsync(optOutKey(userId), '1');
}

async function tokenIfPermitted(): Promise<string | null> {
    if (!Device.isDevice) return null;
    try {
        return (await Notifications.getPermissionsAsync()).granted ? await currentToken() : null;
    } catch {
        return null;
    }
}

/** The switch state: this install's token is registered for `userId` and the OS still allows push. */
export async function readPushEnabled(userId: string): Promise<boolean> {
    if (!(await isPushEnabledFor(userId))) return false;
    try {
        return (await Notifications.getPermissionsAsync()).granted;
    } catch {
        return false;
    }
}

/**
 * The session user became `userId` (sign-in, app start, another account). Never shows the
 * permission dialog: registers only with a permission already granted and no opt-out by this
 * account. Errors are logged; a missed registration is retried at the next start.
 */
export async function syncPushRegistration(userId: string): Promise<void> {
    try {
        if (!Device.isDevice) return;
        if (await SecureStore.getItemAsync(optOutKey(userId))) return;
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) return;
        await ensureAndroidChannel();
        const token = await currentToken();
        if (token) await registerToken(userId, token);
    } catch (error) {
        logWarn('pushNotifications', 'Push registration on sign-in failed', { message: error instanceof Error ? error.message : String(error) });
    }
}

/**
 * The sign-out button, while the session still exists: removes this install's token on the server,
 * bounded by PUSH_SIGN_OUT_TIMEOUT_MS. Never throws; sign-out continues either way.
 */
export async function unregisterPushTokenOnSignOut(): Promise<void> {
    const registration = await readPushRegistration();
    if (!registration) return;
    const options: RequestWithTimeout = {
        method: 'DELETE',
        body: JSON.stringify({ token: registration.token }),
        timeoutMs: PUSH_SIGN_OUT_TIMEOUT_MS,
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            apiRequest(ENDPOINT, options),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Push unregister timed out')), PUSH_SIGN_OUT_TIMEOUT_MS); }),
        ]);
    } catch (error) {
        logWarn('pushNotifications', 'Push token removal on sign-out failed', { message: error instanceof Error ? error.message : String(error) });
    } finally {
        if (timer) clearTimeout(timer);
    }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The booking link of a tapped booking notification ({ bookingId, type } from the server). */
export function bookingUrlFromNotification(response: Notifications.NotificationResponse | null | undefined): string | null {
    const data = response?.notification?.request?.content?.data as { bookingId?: unknown } | undefined;
    const bookingId = typeof data?.bookingId === 'string' ? data.bookingId : '';
    return UUID.test(bookingId) ? `kezek://booking/${bookingId}` : null;
}

/** The notification that opened the app from a cold start, as a booking link. */
export async function initialNotificationUrl(): Promise<string | null> {
    try {
        return bookingUrlFromNotification(await Notifications.getLastNotificationResponseAsync());
    } catch {
        return null;
    }
}

/** Taps on notifications while the app runs, as booking links. Returns the unsubscribe function. */
export function subscribeToNotificationTaps(listener: (url: string) => void): () => void {
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
        const url = bookingUrlFromNotification(response);
        if (url) listener(url);
    });
    return () => subscription.remove();
}
