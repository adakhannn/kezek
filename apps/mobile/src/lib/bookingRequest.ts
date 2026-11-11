import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Serialize SecureStore read/write only; correctness/replay lives in PostgreSQL.
// The write must finish before sending a request, including concurrent taps.
let storageQueue: Promise<unknown> = Promise.resolve();

async function storageKeyFor(input: object) {
    const serialized = JSON.stringify(input, (_key, value: unknown) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
        }
        return value;
    });
    const fingerprint = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, serialized);
    return `booking.request.v1.${fingerprint}`;
}

export function getBookingRequestKey(input: object): Promise<string> {
    const operation = storageQueue.then(async () => {
        const storageKey = await storageKeyFor(input);
        const existing = await SecureStore.getItemAsync(storageKey);
        if (existing) {
            if (!/^[0-9a-f-]{36}$/i.test(existing)) throw new Error('Stored booking request is invalid');
            return existing;
        }
        const bytes = Crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const requestId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
        await SecureStore.setItemAsync(storageKey, requestId);
        return requestId;
    });
    storageQueue = operation.catch(() => undefined);
    return operation;
}

export function acknowledgeBookingRequest(input: object, requestId: string): Promise<void> {
    const operation = storageQueue.then(async () => {
        const storageKey = await storageKeyFor(input);
        if (await SecureStore.getItemAsync(storageKey) === requestId) {
            await SecureStore.deleteItemAsync(storageKey);
        }
    });
    storageQueue = operation.catch(() => undefined);
    return operation;
}
