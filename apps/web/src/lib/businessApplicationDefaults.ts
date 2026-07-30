export type BusinessApplicationAccountEmail = {
    email: string | null;
    enabled?: boolean | null;
    verified?: boolean | null;
};

const INTERNAL_EMAIL_DOMAINS = new Set([
    'whatsapp.kezek.kg',
]);

export function isUsableAccountEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;

    const email = value.trim().toLowerCase();
    const domain = email.split('@')[1];

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        && !!domain
        && !INTERNAL_EMAIL_DOMAINS.has(domain);
}

export function selectBusinessApplicationEmail(params: {
    accountEmail?: string | null;
    notificationEmails?: BusinessApplicationAccountEmail[] | null;
}): string {
    if (isUsableAccountEmail(params.accountEmail)) {
        return params.accountEmail.trim().toLowerCase();
    }

    const candidates = (params.notificationEmails ?? [])
        .filter((candidate) => candidate.verified !== false && isUsableAccountEmail(candidate.email))
        .sort((left, right) => Number(right.enabled === true) - Number(left.enabled === true));

    return candidates[0]?.email?.trim().toLowerCase() ?? '';
}

export function selectBusinessApplicationPhone(params: {
    profilePhone?: string | null;
    accountPhone?: string | null;
    metadataPhone?: string | null;
    whatsAppPhone?: string | null;
    whatsAppVerified?: boolean | null;
}): string {
    const candidates = [
        params.profilePhone,
        params.accountPhone,
        params.metadataPhone,
        params.whatsAppVerified ? params.whatsAppPhone : null,
    ];

    return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())
        ?.trim() ?? '';
}
