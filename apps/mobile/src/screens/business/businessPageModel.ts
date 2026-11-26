/**
 * The public business page (C2, C7): the same data and rules as the web page
 * apps/web/src/app/b/[slug] (page.tsx, BusinessInfo.tsx, promotions/PromotionsPageClient.tsx).
 * Pure helpers, so the screen and its tests share them.
 */
import type { Locale, Translate } from '../../i18n';

export type BusinessPageBusiness = {
    id: string;
    slug: string;
    name: string;
    address: string | null;
    phones: string[] | null;
    contact_phone?: string | null;
    contact_whatsapp?: string | null;
    contact_email?: string | null;
    website_url?: string | null;
    rating_score: number | null;
    tz?: string | null;
};

export type BusinessPageBranch = {
    id: string;
    name: string;
    address?: string | null;
    rating_score: number | null;
    directory_links?: unknown;
    contact_phone?: string | null;
    contact_whatsapp?: string | null;
    contact_email?: string | null;
    website_url?: string | null;
    inherit_business_contacts?: boolean | null;
};

export type BusinessPageService = {
    id: string;
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from?: number | null;
    price_to?: number | null;
    branch_id: string;
};

export type BusinessPageStaff = {
    id: string;
    full_name: string;
    branch_id: string;
    avatar_url?: string | null;
    rating_score: number | null;
};

export type BusinessPagePromotion = {
    id: string;
    branch_id: string;
    promotion_type: string;
    title_ru: string | null;
    title_ky?: string | null;
    title_en?: string | null;
    description_ru?: string | null;
    description_ky?: string | null;
    description_en?: string | null;
    params: Record<string, unknown> | null;
    valid_from?: string | null;
    valid_to?: string | null;
};

export type BusinessPageData = {
    business: BusinessPageBusiness;
    branches: BusinessPageBranch[];
    services: BusinessPageService[];
    staff: BusinessPageStaff[];
    promotions: BusinessPagePromotion[];
};

// ---- Directory links (apps/web/src/lib/directoryLinks.ts) ----

export const DIRECTORY_LINK_KEYS = ['instagram', 'two_gis', 'google_maps', 'yandex_maps'] as const;
export type DirectoryLinkKey = (typeof DIRECTORY_LINK_KEYS)[number];
export type DirectoryLinks = Record<DirectoryLinkKey, string | null>;

// A "2ГИС" button must open 2GIS: each link has to lead to its own service's domain.
const DIRECTORY_LINK_HOSTS: Record<DirectoryLinkKey, RegExp> = {
    instagram: /^(?:[a-z0-9-]+\.)*(?:instagram\.com|instagr\.am)$/,
    two_gis: /^(?:[a-z0-9-]+\.)*2gis\.(?:[a-z]{2,3}|com\.[a-z]{2})$/,
    google_maps: /^(?:[a-z0-9-]+\.)*(?:google\.(?:[a-z]{2,3}|com?\.[a-z]{2})|goo\.gl|g\.page)$/,
    yandex_maps: /^(?:[a-z0-9-]+\.)*(?:yandex\.(?:[a-z]{2,3}|com\.[a-z]{2})|ya\.ru|ya\.cc)$/,
};

const MAX_LINK_LENGTH = 2048;

export function normalizeDirectoryLink(key: DirectoryLinkKey, value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    if (!text || text.length > MAX_LINK_LENGTH) return null;

    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        return null;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password || url.port) return null;

    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!DIRECTORY_LINK_HOSTS[key].test(host)) return null;

    url.protocol = 'https:';
    return url.toString();
}

/** Only the links that lead to their own service, like the web page shows them. */
export function sanitizeDirectoryLinks(input: unknown): DirectoryLinks {
    const source = input && typeof input === 'object' && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
    const value = {} as DirectoryLinks;
    for (const key of DIRECTORY_LINK_KEYS) {
        value[key] = normalizeDirectoryLink(key, source[key]);
    }
    return value;
}

// ---- Public contacts (apps/web/src/lib/businessContacts.ts) ----

export type PublicContacts = {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    website: string | null;
};

/** The branch's own contacts, else the business's ones unless the branch opted out of them. */
export function resolvePublicContacts(business: BusinessPageBusiness, branch?: BusinessPageBranch | null): PublicContacts {
    const inherits = branch?.inherit_business_contacts !== false;
    const website = branch?.website_url || (inherits ? business.website_url : null) || null;
    return {
        phone: branch?.contact_phone || (inherits ? business.contact_phone : null) || null,
        whatsapp: branch?.contact_whatsapp || (inherits ? business.contact_whatsapp : null) || null,
        email: branch?.contact_email || (inherits ? business.contact_email : null) || null,
        website: website && /^https:\/\//i.test(website) ? website : null,
    };
}

export function phoneHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function whatsAppHref(phone: string): string {
    return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function emailHref(email: string): string {
    return `mailto:${email}`;
}

// ---- Texts ----

function localized(locale: Locale, ru: string | null | undefined, ky?: string | null, en?: string | null): string {
    if (locale === 'ky' && ky?.trim()) return ky.trim();
    if (locale === 'en' && en?.trim()) return en.trim();
    return ru?.trim() ?? '';
}

/** The promotion's title in the app language, else the text of its type (promotions page). */
export function promotionTitle(promotion: BusinessPagePromotion, t: Translate): string {
    const title = localized(t.locale, promotion.title_ru, promotion.title_ky, promotion.title_en);
    if (title) return title;

    const params = promotion.params ?? {};
    switch (promotion.promotion_type) {
        case 'free_after_n_visits':
            if (params.visit_count) return t('discovery.promo.freeAfterN', { n: String(params.visit_count) });
            break;
        case 'referral_free':
            return t('discovery.promo.referralFree');
        case 'referral_discount_50':
            return t('discovery.promo.referralDiscount50');
        case 'first_visit_discount':
            if (params.discount_percent) return t('discovery.promo.firstVisitDiscount', { percent: String(params.discount_percent) });
            break;
        case 'birthday_discount':
            if (params.discount_percent) return t('discovery.promo.birthdayDiscount', { percent: String(params.discount_percent) });
            break;
        default:
            break;
    }
    return t('discovery.promo.fallback');
}

export function promotionDescription(promotion: BusinessPagePromotion, locale: Locale): string {
    return localized(locale, promotion.description_ru, promotion.description_ky, promotion.description_en);
}

function formatNumber(value: number, locale: Locale): string {
    return value.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
}

/** "1 000–1 500 сом", "1 000 сом" or "Цена по запросу", as the web business page. */
export function formatServicePrice(service: Pick<BusinessPageService, 'price_from' | 'price_to'>, t: Translate): string {
    const from = typeof service.price_from === 'number' ? service.price_from : null;
    const to = typeof service.price_to === 'number' ? service.price_to : null;

    if (from !== null && to !== null && from !== to) {
        return t('discovery.business.priceRange', { from: formatNumber(from, t.locale), to: formatNumber(to, t.locale) });
    }

    const value = from ?? to;
    return value === null
        ? t('discovery.business.priceOnRequest')
        : t('discovery.business.price', { price: formatNumber(value, t.locale) });
}

/** A YYYY-MM-DD date as DD.MM.YYYY, without Intl (Hermes may lack it). */
export function formatPromotionDate(date: string | null | undefined): string | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date ?? '');
    return match ? `${match[3]}.${match[2]}.${match[1]}` : null;
}
