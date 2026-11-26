import type { Tone } from '../../constants/theme';
import type { MobileI18nKey } from '../../i18n';
import type {
    AdminBranch,
    AdminBusinessApplication,
    AdminBusinessListItem,
    AdminRole,
    AdminUserMini,
    MemberRoleKey,
    RoleApplicationFilter,
} from './adminApi';

/* --------------------------------------------------------------- slugs */

const BUSINESS_LATIN: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
    к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
    х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ъ: '', ь: '',
    ң: 'ng', ү: 'u', ө: 'o',
};

/** The website's slugifyBusinessName (lib/businessSlug.ts): the /b/<slug> address of a business. */
export function slugifyBusinessName(input: string): string {
    const slug = input
        .toLowerCase()
        .trim()
        .split('')
        .map((character) => BUSINESS_LATIN[character] ?? character)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 80);
    return slug || 'business';
}

const CATEGORY_LATIN: Record<string, string> = {
    ...BUSINESS_LATIN,
    ц: 'ts', қ: 'k', ғ: 'g', ә: 'a', ұ: 'u', і: 'i', һ: 'h',
};

/** The website's CategoryForm makeSlug: transliterated, URL-safe; may be empty. */
export function makeCategorySlug(input: string): string {
    let out = '';
    for (const ch of input.toLowerCase().trim()) out += CATEGORY_LATIN[ch] ?? ch;
    return out
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-');
}

/** Empty (the server derives it) or latin, digits and hyphens, at least 2 characters. */
export function isValidCategorySlug(value: string): boolean {
    if (!value.trim()) return true;
    return /^[a-z0-9-]{2,}$/.test(value);
}

/** A role key (POST /admin/api/roles/create): [a-z0-9_-], 2 to 32 characters. */
export function isValidRoleKey(value: string): boolean {
    return /^[a-z0-9_-]{2,32}$/.test(value.trim());
}

/* ---------------------------------------------------------- businesses */

export type BusinessStatusFilter = 'all' | 'approved' | 'moderation';

export function filterBusinesses(items: AdminBusinessListItem[], query: string, status: BusinessStatusFilter) {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
        if (status === 'approved' && item.is_approved !== true) return false;
        if (status === 'moderation' && item.is_approved === true) return false;
        if (!q) return true;
        return [item.name, item.slug, item.address ?? '', item.owner_name ?? '', ...(item.categories ?? [])]
            .some((value) => value.toLowerCase().includes(q));
    });
}

export function businessCounts(items: AdminBusinessListItem[]) {
    const approved = items.filter((item) => item.is_approved === true).length;
    return { total: items.length, approved, moderation: items.length - approved };
}

/** The business card's "Готовность бизнеса" checklist (web /admin/businesses/[id]). */
export function businessSetup(input: { approved: boolean; hasOwner: boolean; branches: number; services: number }) {
    const items: { key: 'approved' | 'owner' | 'branch' | 'services'; label: MobileI18nKey; complete: boolean }[] = [
        { key: 'approved', label: 'admin.businessDetail.setup.approved', complete: input.approved },
        { key: 'owner', label: 'admin.businessDetail.setup.owner', complete: input.hasOwner },
        { key: 'branch', label: 'admin.businessDetail.setup.branch', complete: input.branches > 0 },
        { key: 'services', label: 'admin.businessDetail.setup.services', complete: input.services > 0 },
    ];
    return { items, done: items.filter((item) => item.complete).length };
}

/** "Один номер на строку" → the phones array of PATCH /admin/api/businesses/[id]/update (null when empty). */
export function parsePhonesText(text: string): string[] | null {
    const phones = text.split('\n').map((value) => value.trim()).filter(Boolean);
    return phones.length > 0 ? phones : null;
}

/** Manual business creation can be submitted (the website's ManualBusinessCreateForm.canSubmit). */
export function canSubmitManualBusiness(input: { name: string; slug: string; categories: string[]; reason: string; acknowledged: boolean }) {
    return input.name.trim().length >= 2
        && input.slug.trim().length > 0
        && input.categories.length > 0
        && input.reason.trim().length >= 10
        && input.acknowledged;
}

export const MANUAL_BUSINESS_ERRORS: Record<string, MobileI18nKey> = {
    invalid_name: 'admin.manualBusiness.error.name',
    invalid_slug: 'admin.manualBusiness.error.slug',
    invalid_phone: 'admin.manualBusiness.error.phone',
    categories_required: 'admin.manualBusiness.error.categories',
    invalid_categories: 'admin.manualBusiness.error.categories',
    invalid_branch_limit: 'admin.manualBusiness.error.branchLimit',
    invalid_reason: 'admin.manualBusiness.error.reason',
    acknowledgement_required: 'admin.manualBusiness.error.acknowledgement',
    slug_taken: 'admin.manualBusiness.error.slugTaken',
    possible_duplicate: 'admin.manualBusiness.duplicates.description',
    audit_failed: 'admin.manualBusiness.error.audit',
};

/** Branch limit within the server's range (1..1000) and never below the branches already there. */
export function clampBranchLimit(value: string, current: number): number | null {
    const parsed = Number.parseInt(value.trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000 || parsed < current) return null;
    return parsed;
}

/* ------------------------------------------------------------ branches */

export const DIRECTORY_LINKS = ['instagram', 'two_gis', 'google_maps', 'yandex_maps'] as const;
export type DirectoryLink = (typeof DIRECTORY_LINKS)[number];

export type AdminBranchForm = {
    name: string;
    address: string;
    is_active: boolean;
    lat: string;
    lon: string;
    links: Record<DirectoryLink, string>;
    contact_phone: string;
    contact_whatsapp: string;
    contact_email: string;
    website_url: string;
    inherit_business_contacts: boolean;
};

export const NEW_ADMIN_BRANCH: AdminBranchForm = {
    name: '',
    address: '',
    is_active: true,
    lat: '',
    lon: '',
    links: { instagram: '', two_gis: '', google_maps: '', yandex_maps: '' },
    contact_phone: '',
    contact_whatsapp: '',
    contact_email: '',
    website_url: '',
    inherit_business_contacts: true,
};

export function adminBranchFormFrom(branch: AdminBranch): AdminBranchForm {
    const links = branch.directory_links ?? {};
    return {
        name: branch.name,
        address: branch.address ?? '',
        is_active: branch.is_active,
        lat: branch.lat == null ? '' : String(branch.lat),
        lon: branch.lon == null ? '' : String(branch.lon),
        links: {
            instagram: links.instagram ?? '',
            two_gis: links.two_gis ?? '',
            google_maps: links.google_maps ?? '',
            yandex_maps: links.yandex_maps ?? '',
        },
        contact_phone: branch.contact_phone ?? '',
        contact_whatsapp: branch.contact_whatsapp ?? '',
        contact_email: branch.contact_email ?? '',
        website_url: branch.website_url ?? '',
        inherit_business_contacts: branch.inherit_business_contacts !== false,
    };
}

function coordinate(value: string): number | null | undefined {
    const raw = value.trim().replace(',', '.');
    if (raw === '') return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : undefined;
}

/**
 * The body of the admin branch create/update routes (the website's admin BranchForm): both
 * coordinates or neither, in range. Null when the coordinates cannot be sent.
 */
export function buildAdminBranchPayload(form: AdminBranchForm) {
    const lat = coordinate(form.lat);
    const lon = coordinate(form.lon);
    if (lat === undefined || lon === undefined || (lat === null) !== (lon === null)) return null;
    if (lat !== null && (lat < -90 || lat > 90)) return null;
    if (lon !== null && (lon < -180 || lon > 180)) return null;
    return {
        name: form.name.trim(),
        address: form.address.trim() || null,
        is_active: form.is_active,
        lat,
        lon,
        directory_links: { ...form.links },
        contact_phone: form.contact_phone,
        contact_whatsapp: form.contact_whatsapp,
        contact_email: form.contact_email,
        website_url: form.website_url,
        inherit_business_contacts: form.inherit_business_contacts,
    };
}

/* ------------------------------------------------------------- members */

export const MEMBER_ROLES: MemberRoleKey[] = ['owner', 'admin', 'manager', 'staff', 'client'];
/** The roles the "add member" page grants (no client). */
export const ELEVATED_ROLES: Exclude<MemberRoleKey, 'client'>[] = ['owner', 'admin', 'manager', 'staff'];

export const MEMBER_ROLE_LABELS: Record<MemberRoleKey, MobileI18nKey> = {
    owner: 'admin.members.role.owner',
    admin: 'admin.members.role.admin',
    manager: 'admin.members.role.manager',
    staff: 'admin.members.role.staff',
    client: 'admin.members.role.client',
};

export function isMemberRole(value: string): value is MemberRoleKey {
    return (MEMBER_ROLES as string[]).includes(value);
}

/** The roles a member can still be given, in the website's order. */
export function availableRoles(roles: string[]): MemberRoleKey[] {
    return MEMBER_ROLES.filter((role) => !roles.includes(role));
}

/* -------------------------------------------------------------- people */

/** "Имя • email • телефон", or the id when the account has none of them (the website's labels). */
export function userLabel(user: Pick<AdminUserMini, 'id' | 'full_name' | 'email' | 'phone'>): string {
    const parts = [user.full_name, user.email, user.phone].filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(' • ') : user.id;
}

/** Contacts under the name: email and phone. */
export function userContacts(user: Pick<AdminUserMini, 'email' | 'phone'>): string | undefined {
    const parts = [user.email, user.phone].filter((part): part is string => !!part);
    return parts.length > 0 ? parts.join(' · ') : undefined;
}

/** The owners list differs from what is saved (the website's OwnerForm `changed`). */
export function ownersChanged(saved: { id: string }[], next: { id: string }[]): boolean {
    const a = new Set(saved.map((owner) => owner.id));
    const b = new Set(next.map((owner) => owner.id));
    if (a.size !== b.size) return true;
    for (const value of a) if (!b.has(value)) return true;
    return false;
}

/** E.164 as the website's user form demands (+996XXXXXXXXX); empty is allowed. */
export function isE164OrEmpty(value: string): boolean {
    const v = value.trim();
    return v === '' || /^\+[1-9]\d{7,14}$/.test(v);
}

export function isEmailOrEmpty(value: string): boolean {
    const v = value.trim();
    return v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function pageCount(total: number, perPage: number): number {
    return Math.max(1, Math.ceil(total / Math.max(1, perPage)));
}

/* --------------------------------------------------------------- roles */

export function filterRoles(items: AdminRole[], query: string): AdminRole[] {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((role) => [role.key, role.name, role.description ?? ''].some((value) => value.toLowerCase().includes(q)));
}

/* ---------------------------------------------------------- applications */

export type BusinessApplicationFilter = 'all' | 'new' | 'contacted' | 'approved' | 'rejected';

export const BUSINESS_APPLICATION_STATUS: Record<string, MobileI18nKey> = {
    new: 'admin.businessApplications.status.new',
    contacted: 'admin.businessApplications.status.contacted',
    approved: 'admin.businessApplications.status.approved',
    rejected: 'admin.businessApplications.status.rejected',
};

/** The website's canModerateBusinessRegistrationApplication: new or contacted. */
export function canModerateBusinessApplication(status: string | null | undefined): boolean {
    return status === 'new' || status === 'contacted';
}

/**
 * The application's category: a known active category (by slug or name, case-insensitive), or a
 * proposed one the admin must create first (approval stays blocked until then).
 */
export function applicationCategory(application: Pick<AdminBusinessApplication, 'category'>, names: Record<string, string>) {
    const raw = application.category?.trim() ?? '';
    const known = raw ? names[raw.toLowerCase()] ?? null : null;
    return { raw, known, proposed: Boolean(raw && !known) };
}

export function filterBusinessApplications(items: AdminBusinessApplication[], status: BusinessApplicationFilter, query: string) {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
        if (status !== 'all' && item.status !== status) return false;
        if (!q) return true;
        return [item.business_name, item.contact_name, item.phone, item.email, item.category]
            .some((value) => (value ?? '').toLowerCase().includes(q));
    });
}

/** The website's ApplicationReviewHistory: what to say about earlier submissions (null: nothing). */
export function reviewHistory(count: number, flags: string[]) {
    const repeated = count > 0 || flags.includes('repeat_applicant') || flags.includes('high_submission_volume');
    const rejected = flags.includes('prior_rejection');
    const other = flags.some((flag) => !['repeat_applicant', 'high_submission_volume', 'prior_rejection'].includes(flag));
    if (!repeated && !rejected && !other) return null;
    return { repeated, rejected, other };
}

export const ROLE_APPLICATION_FILTERS: RoleApplicationFilter[] = ['pending', 'approved', 'rejected', 'cancelled', 'all'];

export const ROLE_APPLICATION_STATUS_LABELS: Record<RoleApplicationFilter, MobileI18nKey> = {
    pending: 'admin.roleApplications.status.pending',
    approved: 'admin.roleApplications.status.approved',
    rejected: 'admin.roleApplications.status.rejected',
    cancelled: 'admin.roleApplications.status.cancelled',
    all: 'admin.roleApplications.status.all',
};

export const ROLE_APPLICATION_STATE_LABELS: Record<Exclude<RoleApplicationFilter, 'all'>, MobileI18nKey> = {
    pending: 'admin.applicationHistory.status.pending',
    approved: 'admin.applicationHistory.status.approved',
    rejected: 'admin.applicationHistory.status.rejected',
    cancelled: 'admin.applicationHistory.status.cancelled',
};

export const ROLE_APPLICATION_ROLE_LABELS: Record<'owner' | 'admin' | 'manager' | 'staff', MobileI18nKey> = {
    owner: 'admin.roleApplications.role.owner',
    admin: 'admin.roleApplications.role.admin',
    manager: 'admin.roleApplications.role.manager',
    staff: 'admin.roleApplications.role.staff',
};

/* ------------------------------------------------------------- bookings */

export const BOOKING_STATUS_LABELS: Record<string, MobileI18nKey> = {
    confirmed: 'admin.home.bookingsToday.status.confirmed',
    hold: 'admin.home.bookingsToday.status.hold',
    canceled: 'admin.home.bookingsToday.status.cancelled',
    cancelled: 'admin.home.bookingsToday.status.cancelled',
    paid: 'admin.home.bookingsToday.status.paid',
};

export function bookingStatusTone(status: string): Tone {
    if (status === 'confirmed' || status === 'paid') return 'success';
    if (status === 'hold') return 'warning';
    if (status === 'cancelled' || status === 'canceled') return 'danger';
    return 'neutral';
}

/** Today's bookings by status (cancelled and canceled together), as the home's chips count them. */
export function todayStatusCounts(bookings: { status: string }[]) {
    const by = (status: string) => bookings.filter((booking) => booking.status === status).length;
    return { hold: by('hold'), confirmed: by('confirmed'), cancelled: by('cancelled') + by('canceled') };
}
