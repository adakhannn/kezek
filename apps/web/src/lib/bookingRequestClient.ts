type StoredBookingRequest = { requestId: string; guestSecret?: string };
type BookingStorage = Pick<Storage, 'getItem' | 'setItem'>;

function canonicalPayload(input: object): string {
    return JSON.stringify(input, (_key, value: unknown) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
        }
        return value;
    });
}

function randomHex(crypto: Crypto, size: number) {
    return Array.from(crypto.getRandomValues(new Uint8Array(size)), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function storageKeyFor(input: object, guest: boolean, crypto: Crypto) {
    if (!crypto?.subtle) throw new Error('Secure booking request storage is unavailable');
    const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest(
        'SHA-256', new TextEncoder().encode(`${guest ? 'guest' : 'user'}:${canonicalPayload(input)}`),
    )), (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `kezek.booking.v1.${fingerprint}`;
}

/** Persist before POST. Storage failures fail closed rather than minting a new retry key. */
export async function getBookingRequestHeaders(
    input: object,
    guest: boolean,
    deps: { storage?: BookingStorage; crypto?: Crypto } = {},
): Promise<Record<string, string>> {
    const crypto = deps.crypto ?? globalThis.crypto;
    const storage = deps.storage ?? window.sessionStorage;
    const storageKey = await storageKeyFor(input, guest, crypto);
    const stored = storage.getItem(storageKey);
    let identity: StoredBookingRequest;
    if (stored) {
        identity = JSON.parse(stored) as StoredBookingRequest;
        if (!/^[0-9a-f-]{36}$/.test(identity.requestId) ||
            (guest && !/^[0-9a-f]{64}$/.test(identity.guestSecret ?? ''))) {
            throw new Error('Stored booking request is invalid');
        }
    } else {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        identity = { requestId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}` };
        if (guest) identity.guestSecret = randomHex(crypto, 32);
        storage.setItem(storageKey, JSON.stringify(identity));
    }
    return {
        'Idempotency-Key': identity.requestId,
        ...(guest ? { 'X-Booking-Client-Token': identity.guestSecret! } : {}),
    };
}

/** A confirmed response ends this attempt; a later deliberate booking gets a new key. */
export async function acknowledgeBookingRequest(
    input: object,
    guest: boolean,
    headers: Record<string, string>,
    deps: { storage?: Pick<Storage, 'getItem' | 'removeItem'>; crypto?: Crypto } = {},
): Promise<void> {
    const storage = deps.storage ?? window.sessionStorage;
    const storageKey = await storageKeyFor(input, guest, deps.crypto ?? globalThis.crypto);
    const stored = storage.getItem(storageKey);
    if (stored && (JSON.parse(stored) as StoredBookingRequest).requestId === headers['Idempotency-Key']) {
        storage.removeItem(storageKey);
    }
}
