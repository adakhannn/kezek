import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Serialize SecureStore read/write only; correctness/replay lives in PostgreSQL.
// The write must finish before sending a request, including concurrent taps.
let storageQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const operation = storageQueue.then(work);
    storageQueue = operation.catch(() => undefined);
    return operation;
}

function canonical(value: object): string {
    return JSON.stringify(value, (_key, item: unknown) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)));
        }
        return item;
    });
}

function randomHex(size: number): string {
    return Array.from(Crypto.getRandomValues(new Uint8Array(size)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newRequestId(): string {
    const bytes = Crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// The key is bound to the account: another account on the device books the same slot under
// its own identity and never replays the previous account's request.
async function storageKeyFor(userId: string, input: object) {
    if (!userId) throw new Error('Booking request needs a signed-in user');
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, canonical({ userId, input }));
    return `booking.request.v2.${fingerprint}`;
}

export function getBookingRequestKey(userId: string, input: object): Promise<string> {
    return enqueue(async () => {
        const storageKey = await storageKeyFor(userId, input);
        const existing = await SecureStore.getItemAsync(storageKey);
        if (existing) {
            if (!/^[0-9a-f-]{36}$/i.test(existing)) throw new Error('Stored booking request is invalid');
            return existing;
        }
        const requestId = newRequestId();
        await SecureStore.setItemAsync(storageKey, requestId);
        return requestId;
    });
}

export function acknowledgeBookingRequest(userId: string, input: object, requestId: string): Promise<void> {
    return enqueue(async () => {
        const storageKey = await storageKeyFor(userId, input);
        if (await SecureStore.getItemAsync(storageKey) === requestId) {
            await SecureStore.deleteItemAsync(storageKey);
        }
    });
}

/** A guest booking request: the Idempotency-Key and the guest secret (X-Booking-Client-Token). */
export type GuestBookingRequestIdentity = { requestId: string; guestSecret: string };

// The guest payload holds the name and phone, so the key is its hash, never the payload.
async function guestStorageKeyFor(input: object) {
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `guest:${canonical(input)}`);
    return `booking.guest.v1.${fingerprint}`;
}

/**
 * The identity of a guest booking attempt (web bookingRequestClient, guest = true), persisted
 * before the request: a retry after a lost answer replays the same request and proves it with the
 * same secret. A storage failure fails closed instead of minting a new identity.
 */
export function getGuestBookingRequestIdentity(input: object): Promise<GuestBookingRequestIdentity> {
    return enqueue(async () => {
        const storageKey = await guestStorageKeyFor(input);
        const existing = await SecureStore.getItemAsync(storageKey);
        if (existing) {
            const parsed = JSON.parse(existing) as Partial<GuestBookingRequestIdentity>;
            if (
                typeof parsed.requestId !== 'string' ||
                !/^[0-9a-f-]{36}$/i.test(parsed.requestId) ||
                typeof parsed.guestSecret !== 'string' ||
                !/^[0-9a-f]{64}$/.test(parsed.guestSecret)
            ) {
                throw new Error('Stored booking request is invalid');
            }
            return { requestId: parsed.requestId, guestSecret: parsed.guestSecret };
        }
        const identity = { requestId: newRequestId(), guestSecret: randomHex(32) };
        await SecureStore.setItemAsync(storageKey, JSON.stringify(identity));
        return identity;
    });
}

/** A confirmed answer ends the guest attempt; a later deliberate booking gets a new identity. */
export function acknowledgeGuestBookingRequest(input: object, requestId: string): Promise<void> {
    return enqueue(async () => {
        const storageKey = await guestStorageKeyFor(input);
        const existing = await SecureStore.getItemAsync(storageKey);
        if (existing && (JSON.parse(existing) as Partial<GuestBookingRequestIdentity>).requestId === requestId) {
            await SecureStore.deleteItemAsync(storageKey);
        }
    });
}
