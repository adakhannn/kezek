/**
 * Links that open the phone's dialer and WhatsApp for a client number (S1, O1). Null when the
 * value has no digits to dial.
 */
export function telUrl(phone: string | null | undefined): string | null {
    const value = (phone ?? '').replace(/[^\d+]/g, '');
    return /\d/.test(value) ? `tel:${value}` : null;
}

export function whatsAppUrl(phone: string | null | undefined): string | null {
    const digits = (phone ?? '').replace(/\D/g, '');
    return digits.length >= 7 ? `https://wa.me/${digits}` : null;
}
