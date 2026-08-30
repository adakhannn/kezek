import { isE164, isEmail } from '@shared-client/validation';

export type PublicContactFields = {
    contact_phone?: string | null;
    contact_whatsapp?: string | null;
    contact_email?: string | null;
    website_url?: string | null;
};

export type BranchContactFields = PublicContactFields & {
    inherit_business_contacts?: boolean | null;
};

export type ResolvedPublicContacts = {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
    source: 'branch' | 'business' | 'none';
};

export type PublicContactValidation =
    | { ok: true; value: Required<PublicContactFields> }
    | { ok: false; field: keyof PublicContactFields; message: string };

function optionalText(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePhone(value: unknown): string | null {
    const text = optionalText(value);
    if (!text) return null;
    const digits = text.replace(/\D/g, '');
    return digits ? `+${digits}` : null;
}

function normalizeHttpsUrl(value: unknown): string | null {
    const text = optionalText(value);
    if (!text) return null;
    try {
        const url = new URL(text);
        return url.protocol === 'https:' ? url.toString() : null;
    } catch {
        return null;
    }
}

export function validatePublicContacts(input: PublicContactFields): PublicContactValidation {
    const contact_phone = normalizePhone(input.contact_phone);
    const contact_whatsapp = normalizePhone(input.contact_whatsapp);
    const contact_email = optionalText(input.contact_email)?.toLowerCase() ?? null;
    const websiteInput = optionalText(input.website_url);
    const website_url = normalizeHttpsUrl(websiteInput);

    if (contact_phone && !isE164(contact_phone)) {
        return { ok: false, field: 'contact_phone', message: 'Укажите телефон в международном формате' };
    }
    if (contact_whatsapp && !isE164(contact_whatsapp)) {
        return { ok: false, field: 'contact_whatsapp', message: 'Укажите WhatsApp в международном формате' };
    }
    if (contact_email && (!isEmail(contact_email) || contact_email.length > 254)) {
        return { ok: false, field: 'contact_email', message: 'Укажите корректный публичный email' };
    }
    if (websiteInput && !website_url) {
        return { ok: false, field: 'website_url', message: 'Сайт должен быть корректной HTTPS-ссылкой' };
    }

    return {
        ok: true,
        value: {
            contact_phone,
            contact_whatsapp,
            contact_email,
            website_url,
        },
    };
}

export function resolvePublicContacts(
    business: PublicContactFields,
    branch?: BranchContactFields | null,
): ResolvedPublicContacts {
    const inherits = branch?.inherit_business_contacts !== false;
    const resolved = {
        phone: branch?.contact_phone || (inherits ? business.contact_phone : null) || null,
        whatsapp: branch?.contact_whatsapp || (inherits ? business.contact_whatsapp : null) || null,
        email: branch?.contact_email || (inherits ? business.contact_email : null) || null,
        website: branch?.website_url || (inherits ? business.website_url : null) || null,
    };

    const hasBranchValue = Boolean(
        branch?.contact_phone ||
            branch?.contact_whatsapp ||
            branch?.contact_email ||
            branch?.website_url,
    );
    const hasAnyValue = Boolean(resolved.phone || resolved.whatsapp || resolved.email || resolved.website);

    return {
        ...resolved,
        source: hasBranchValue ? 'branch' : hasAnyValue ? 'business' : 'none',
    };
}

export function phoneHref(phone: string): string {
    return `tel:${phone}`;
}

export function whatsAppHref(phone: string): string {
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function emailHref(email: string): string {
    return `mailto:${email}`;
}
