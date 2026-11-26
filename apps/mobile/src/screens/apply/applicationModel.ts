/**
 * The website's business and role applications (apps/web/src/app/business/*): defaults, checks
 * before sending and the error texts of the API codes, shared by the app's application screens.
 */
import type { MobileI18nKey } from '../../i18n';

/** Choice of the category list meaning "my category is missing, I propose one". */
export const PROPOSE_CATEGORY_VALUE = '__propose_category__';

export type CategoryOption = { slug: string; name: string };

export type BusinessApplicationForm = {
    contact_name: string;
    phone: string;
    email: string;
    business_name: string;
    comment: string;
    instagram: string;
    two_gis: string;
    google_maps: string;
    yandex_maps: string;
};

export const EMPTY_BUSINESS_APPLICATION: BusinessApplicationForm = {
    contact_name: '',
    phone: '',
    email: '',
    business_name: '',
    comment: '',
    instagram: '',
    two_gis: '',
    google_maps: '',
    yandex_maps: '',
};

/** The texts of the /api/business-applications codes (web BusinessApplicationForm). */
export const BUSINESS_APPLICATION_ERROR_KEYS: Partial<Record<string, MobileI18nKey>> = {
    auth_required: 'parity.apply.error.authRequired',
    invalid_request: 'parity.apply.error.invalidRequest',
    required_fields: 'parity.apply.error.requiredFields',
    invalid_email: 'parity.apply.error.invalidEmail',
    service_unavailable: 'parity.apply.error.serviceUnavailable',
    business_exists: 'parity.apply.error.businessExists',
    recent_duplicate: 'parity.apply.error.recentDuplicate',
    pending_duplicate: 'parity.apply.error.pendingDuplicate',
    blocked: 'parity.apply.error.blocked',
    active_limit: 'parity.apply.error.activeLimit',
    monthly_limit: 'parity.apply.error.monthlyLimit',
    cooldown_24h: 'parity.apply.error.cooldown24h',
};

/** The code of an API error body ({ ok: false, code }), as ApiError carries it in `details`. */
export function applicationErrorCode(error: unknown): string | null {
    const details = (error as { details?: unknown } | null)?.details;
    if (details && typeof details === 'object') {
        const code = (details as { code?: unknown }).code;
        if (typeof code === 'string') return code;
    }
    return null;
}

export function businessApplicationErrorKey(error: unknown): MobileI18nKey {
    const code = applicationErrorCode(error);
    return (code ? BUSINESS_APPLICATION_ERROR_KEYS[code] : undefined) ?? 'parity.apply.error.submit';
}

/** The category sent: the chosen slug, or the proposed name. */
export function resolveCategory(choice: string, proposed: string): string {
    return choice === PROPOSE_CATEGORY_VALUE ? proposed.trim() : choice;
}

/** The first check of the form before sending, else null (the server checks the rest). */
export function businessApplicationError(
    form: BusinessApplicationForm,
    choice: string,
    proposed: string,
): MobileI18nKey | null {
    if (!form.contact_name.trim() || !form.phone.trim() || !form.email.trim() || !form.business_name.trim()) {
        return 'parity.apply.error.requiredFields';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'parity.apply.error.invalidEmail';
    if (!resolveCategory(choice, proposed)) {
        return choice === PROPOSE_CATEGORY_VALUE ? 'parity.apply.error.proposedCategoryRequired' : 'parity.apply.error.categoryRequired';
    }
    return null;
}

// Prefill, as apps/web/src/lib/businessApplicationDefaults.ts.

const INTERNAL_EMAIL_DOMAINS = new Set(['whatsapp.kezek.kg']);

export function isUsableAccountEmail(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const email = value.trim().toLowerCase();
    const domain = email.split('@')[1];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !!domain && !INTERNAL_EMAIL_DOMAINS.has(domain);
}

export type AccountEmail = { email: string | null; enabled?: boolean | null; verified?: boolean | null };

export function selectApplicationEmail(params: { accountEmail?: string | null; notificationEmails?: AccountEmail[] | null }): string {
    if (isUsableAccountEmail(params.accountEmail)) return params.accountEmail.trim().toLowerCase();
    const candidates = (params.notificationEmails ?? [])
        .filter((candidate) => candidate.verified !== false && isUsableAccountEmail(candidate.email))
        .sort((left, right) => Number(right.enabled === true) - Number(left.enabled === true));
    return candidates[0]?.email?.trim().toLowerCase() ?? '';
}

export function selectApplicationPhone(params: {
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
    return candidates.find((candidate) => typeof candidate === 'string' && candidate.trim())?.trim() ?? '';
}

// Role applications (web RoleApplicationForm).

export type RoleApplicationMode = 'owner' | 'staff';

export type EvidenceLinks = { instagram: string; two_gis: string; google_maps: string; yandex_maps: string };

export const EMPTY_EVIDENCE: EvidenceLinks = { instagram: '', two_gis: '', google_maps: '', yandex_maps: '' };

export type BusinessOption = { id: string; name: string; slug: string | null };

export type MyRoleApplication = {
    id: string;
    biz_id: string;
    requested_role: RoleApplicationMode;
    status: 'pending';
    created_at: string;
    businesses: { name: string | null; slug: string | null } | { name: string | null; slug: string | null }[] | null;
};

export function applicationBusinessName(application: MyRoleApplication): string {
    const relation = Array.isArray(application.businesses) ? application.businesses[0] ?? null : application.businesses;
    return relation?.name || application.biz_id;
}

/** The business search starts at two characters, like the website. */
export const MIN_BUSINESS_QUERY = 2;

export function roleApplicationError(params: {
    mode: RoleApplicationMode;
    bizId: string;
    message: string;
    evidence: EvidenceLinks;
}): MobileI18nKey | null {
    if (!params.bizId) return 'parity.roleApply.form.errors.selectBusiness';
    if (
        params.mode === 'owner'
        && params.message.trim().length < 20
        && !Object.values(params.evidence).some((value) => value.trim())
    ) {
        return 'parity.roleApply.form.errors.ownerEvidence';
    }
    return null;
}
