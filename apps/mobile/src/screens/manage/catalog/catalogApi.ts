import { apiRequest } from '../../../lib/api';
import { ensureCurrentBusiness } from '../currentBusiness';

/**
 * The web cabinet's routes behind the services, branches and settings screens (the website's
 * /dashboard/services, /dashboard/branches, /dashboard/settings). Every call first makes the
 * screen's business the current one, because the routes act on the current business.
 */

export type CatalogBranch = { id: string; name: string };

/** One logical service: the copies of one name_ru across branches (GET /api/dashboard/services). */
export type ManagedService = {
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_ids: string[];
    first_id: string;
};

export type ServicesOverview = {
    services: ManagedService[];
    branches: CatalogBranch[];
    bizName: string | null;
    bizCity: string | null;
};

export type ServiceForEdit = {
    service: {
        id: string;
        name_ru: string;
        name_ky: string | null;
        name_en: string | null;
        duration_min: number;
        price_from: number;
        price_to: number;
        active: boolean;
        branch_id: string;
    };
    branches: CatalogBranch[];
    serviceBranchIds: string[];
};

export type ContactFields = {
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
};

export type BranchesOverview = {
    branches: { id: string; name: string; address: string | null; is_active: boolean | null }[];
    branchLimit: number;
    isSuperAdmin: boolean;
    canManageBranches: boolean;
    canCreateBranch: boolean;
    businessSlug: string | null;
    businessName: string | null;
    businessContacts: ContactFields;
};

export type TimeRange = { start: string; end: string };
export type BranchScheduleRow = { day_of_week: number; intervals: TimeRange[]; breaks: TimeRange[] };

export type BranchRatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

export type BranchForEdit = {
    branch: ContactFields & {
        id: string;
        name: string;
        address: string | null;
        is_active: boolean;
        lat: number | null;
        lon: number | null;
        rating_score: number | null;
        inherit_business_contacts: boolean;
    };
    schedule: BranchScheduleRow[];
    ratingWeights: BranchRatingWeights | null;
    isSuperAdmin: boolean;
    bizSlug: string | null;
    bizName: string | null;
    businessContacts: ContactFields;
};

export type BusinessSettings = ContactFields & { tz: string };

type Envelope<T> = { ok?: boolean; data?: T; archived?: boolean };

async function call<T>(bizId: string, endpoint: string, init?: RequestInit): Promise<Envelope<T>> {
    await ensureCurrentBusiness(bizId);
    const response = await apiRequest<Envelope<T>>(endpoint, init);
    if (response?.ok === false) throw new Error('Request was not applied');
    return response;
}

async function read<T>(bizId: string, endpoint: string): Promise<T> {
    const response = await call<T>(bizId, endpoint);
    if (!response?.ok || response.data === undefined) throw new Error('Unexpected response');
    return response.data;
}

function post(body: unknown, method = 'POST'): RequestInit {
    return { method, body: JSON.stringify(body) };
}

const id = encodeURIComponent;

export const catalogApi = {
    services: (bizId: string, branchFilter: string) =>
        read<ServicesOverview>(bizId, `/dashboard/services${branchFilter ? `?branch=${id(branchFilter)}` : ''}`),
    service: (bizId: string, serviceId: string) => read<ServiceForEdit>(bizId, `/dashboard/services/${id(serviceId)}`),
    createService: (bizId: string, payload: unknown) => call(bizId, '/services/create', post(payload)),
    updateService: (bizId: string, serviceId: string, payload: unknown) =>
        call(bizId, `/services/${id(serviceId)}/update`, post(payload)),
    /** `archived`: the service had bookings, so it was switched off instead of deleted (DB-14). */
    deleteService: async (bizId: string, serviceId: string) =>
        !!(await call(bizId, `/services/${id(serviceId)}/delete`, { method: 'POST' })).archived,

    branches: (bizId: string) => read<BranchesOverview>(bizId, '/dashboard/branches'),
    branch: (bizId: string, branchId: string) => read<BranchForEdit>(bizId, `/dashboard/branches/${id(branchId)}`),
    createBranch: (bizId: string, payload: unknown) => call(bizId, '/branches/create', post(payload)),
    updateBranch: (bizId: string, branchId: string, payload: unknown) =>
        call(bizId, `/branches/${id(branchId)}/update`, post(payload)),
    deleteBranch: (bizId: string, branchId: string) => call(bizId, `/branches/${id(branchId)}/delete`, { method: 'POST' }),
    saveSchedule: (bizId: string, branchId: string, schedule: BranchScheduleRow[]) =>
        call(bizId, `/branches/${id(branchId)}/schedule`, post({ schedule })),

    promotions: async (bizId: string, branchId: string) =>
        (await read<{ promotions?: Promotion[] }>(bizId, `/dashboard/branches/${id(branchId)}/promotions`)).promotions ?? [],
    createPromotion: (bizId: string, branchId: string, payload: unknown) =>
        call(bizId, `/dashboard/branches/${id(branchId)}/promotions`, post(payload)),
    updatePromotion: (bizId: string, branchId: string, promotionId: string, payload: unknown) =>
        call(bizId, `/dashboard/branches/${id(branchId)}/promotions/${id(promotionId)}`, post(payload, 'PATCH')),
    /** `archived`: clients already used it, so it was switched off instead of deleted (DB-14). */
    deletePromotion: async (bizId: string, branchId: string, promotionId: string) =>
        !!(await call(bizId, `/dashboard/branches/${id(branchId)}/promotions/${id(promotionId)}`, { method: 'DELETE' })).archived,

    settings: (bizId: string) => read<BusinessSettings>(bizId, '/dashboard/contact-settings'),
    saveSettings: async (bizId: string, patch: Partial<BusinessSettings>) => {
        const response = await call<BusinessSettings>(bizId, '/dashboard/contact-settings', post(patch));
        return response.data ?? null;
    },
};

export type PromotionType =
    | 'free_after_n_visits'
    | 'referral_free'
    | 'referral_discount_50'
    | 'birthday_discount'
    | 'first_visit_discount';

export type Promotion = {
    id: string;
    promotion_type: PromotionType;
    params: Record<string, unknown>;
    title_ru: string;
    is_active: boolean;
    valid_from?: string | null;
    valid_to?: string | null;
    created_at: string;
    usage_count?: number;
};

/** react-query keys: everything of one business shares the prefix, so a write refreshes it all. */
export const catalogKeys = {
    all: (bizId: string) => ['manage', bizId] as const,
    services: (bizId: string, branchFilter: string) => ['manage', bizId, 'services', branchFilter] as const,
    service: (bizId: string, serviceId: string) => ['manage', bizId, 'service', serviceId] as const,
    serviceMasters: (bizId: string, serviceId: string) => ['manage', bizId, 'serviceMasters', serviceId] as const,
    branches: (bizId: string) => ['manage', bizId, 'branches'] as const,
    branch: (bizId: string, branchId: string) => ['manage', bizId, 'branch', branchId] as const,
    promotions: (bizId: string, branchId: string) => ['manage', bizId, 'promotions', branchId] as const,
    settings: (bizId: string) => ['manage', bizId, 'settings'] as const,
};
