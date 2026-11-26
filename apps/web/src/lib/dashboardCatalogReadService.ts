import type { ManagerBusinessContext } from '@/lib/bizContextResolver';
import type { DbClient } from '@/lib/supabaseTypes';
import { getBusinessTimezone } from '@/lib/time';

/**
 * Read models of the business dashboard's services, branches and settings pages, as JSON for the
 * mobile app (the same queries and permission rules as /dashboard/services, /dashboard/branches and
 * /dashboard/settings). Every read is scoped by the current business; callers check access first.
 */

type Failure = { ok: false; error: 'not_found' | 'forbidden' | 'server'; message: string; status: 403 | 404 | 500; details?: unknown };
type Result<T> = { ok: true; data: T } | Failure;

export type ServiceRow = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean | null;
    branch_id: string;
};

/** One logical service of the management list: the copies of one name_ru across branches. */
export type GroupedService = {
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active: boolean;
    branch_ids: string[];
    /** The copy opened for editing. */
    first_id: string;
};

/**
 * Groups service copies by name_ru (the management list of /dashboard/services). Fully hidden
 * services stay listed for editing/reactivation; a hidden copy of a service that still has active
 * copies is left out, because update works on the name group, not on separate copies.
 */
export function groupServicesForManagement(services: ServiceRow[], branchFilter: string): GroupedService[] {
    const serviceMap = new Map<string, GroupedService>();
    const activeServiceNames = new Set(services.filter((s) => s.active).map((s) => s.name_ru));
    for (const s of services) {
        if (branchFilter && s.branch_id !== branchFilter) continue;
        if (!s.active && activeServiceNames.has(s.name_ru)) continue;
        const existing = serviceMap.get(s.name_ru);
        if (!existing) {
            serviceMap.set(s.name_ru, {
                name_ru: s.name_ru,
                name_ky: s.name_ky,
                name_en: s.name_en,
                duration_min: s.duration_min,
                price_from: s.price_from,
                price_to: s.price_to,
                active: s.active ?? false,
                branch_ids: [s.branch_id],
                first_id: s.id,
            });
            continue;
        }
        if (!existing.branch_ids.includes(s.branch_id)) existing.branch_ids.push(s.branch_id);
        if (s.active) existing.active = true;
    }
    return Array.from(serviceMap.values());
}

type Branch = { id: string; name: string };

function dbFailure(message: string, error: unknown): Failure {
    return { ok: false, error: 'server', message, status: 500, details: error instanceof Object && 'message' in error ? (error as { message: unknown }).message : undefined };
}

/** GET /api/dashboard/services: the grouped list, the active branches and the business. */
export async function loadServicesOverview(params: {
    supabase: DbClient;
    bizId: string;
    business: Pick<ManagerBusinessContext, 'name' | 'city'> | null;
    branchFilter: string;
}): Promise<Result<{ services: GroupedService[]; branches: Branch[]; bizName: string | null; bizCity: string | null }>> {
    const [{ data: branches, error: branchesError }, { data: services, error }] = await Promise.all([
        params.supabase.from('branches').select('id,name').eq('biz_id', params.bizId).eq('is_active', true).order('name'),
        params.supabase
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id')
            .eq('biz_id', params.bizId)
            .order('name_ru'),
    ]);
    // FE-08: a failed read is an error, never an empty list.
    if (branchesError) return dbFailure('Не удалось загрузить филиалы', branchesError);
    if (error) return dbFailure('Не удалось загрузить услуги', error);
    return {
        ok: true,
        data: {
            services: groupServicesForManagement((services ?? []) as ServiceRow[], params.branchFilter),
            branches: (branches ?? []) as Branch[],
            bizName: params.business?.name ?? null,
            bizCity: params.business?.city ?? null,
        },
    };
}

/** GET /api/dashboard/services/[id]: the service, the active branches and the branches of its copies. */
export async function loadServiceForEdit(params: {
    admin: DbClient;
    bizId: string;
    serviceId: string;
}): Promise<Result<{ service: Omit<ServiceRow, 'active'> & { active: boolean }; branches: Branch[]; serviceBranchIds: string[] }>> {
    const { admin, bizId, serviceId } = params;
    const [{ data: svc, error: svcError }, { data: branches, error: branchesError }] = await Promise.all([
        admin
            .from('services')
            .select('id,name_ru,name_ky,name_en,duration_min,price_from,price_to,active,branch_id,biz_id')
            .eq('id', serviceId)
            .eq('biz_id', bizId)
            .maybeSingle(),
        admin.from('branches').select('id,name').eq('biz_id', bizId).eq('is_active', true).order('name'),
    ]);
    if (svcError || branchesError) return dbFailure('Не удалось загрузить услугу', svcError ?? branchesError);
    if (!svc || String(svc.biz_id) !== String(bizId)) {
        return { ok: false, error: 'not_found', message: 'Услуга не найдена', status: 404 };
    }
    // A hidden service keeps its saved branch selection: copies with the same visibility.
    const { data: copies, error: copiesError } = await admin
        .from('services')
        .select('branch_id')
        .eq('biz_id', bizId)
        .eq('name_ru', svc.name_ru)
        .eq('active', !!svc.active);
    if (copiesError) return dbFailure('Не удалось загрузить услугу', copiesError);
    return {
        ok: true,
        data: {
            service: {
                id: String(svc.id),
                name_ru: String(svc.name_ru),
                name_ky: svc.name_ky || null,
                name_en: svc.name_en || null,
                duration_min: Number(svc.duration_min),
                price_from: Number(svc.price_from),
                price_to: Number(svc.price_to),
                active: !!svc.active,
                branch_id: String(svc.branch_id),
            },
            branches: (branches ?? []) as Branch[],
            serviceBranchIds: Array.from(new Set((copies ?? []).map((row: { branch_id: string }) => row.branch_id))),
        },
    };
}

type ContactFields = {
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
};

function contactsOf(row: Partial<ContactFields> | null | undefined): ContactFields {
    return {
        contact_phone: row?.contact_phone ?? null,
        contact_whatsapp: row?.contact_whatsapp ?? null,
        contact_email: row?.contact_email ?? null,
        website_url: row?.website_url ?? null,
    };
}

/** GET /api/dashboard/branches: every branch of the business and what the user may do with them. */
export async function loadBranchesOverview(params: {
    supabase: DbClient;
    userId: string;
    bizId: string;
    business: Pick<ManagerBusinessContext, 'name' | 'slug' | 'owner_id' | 'branch_limit'> & Partial<ContactFields> | null;
}): Promise<Result<{
    branches: Array<{ id: string; name: string; address: string | null; is_active: boolean | null }>;
    branchLimit: number;
    isSuperAdmin: boolean;
    canManageBranches: boolean;
    canCreateBranch: boolean;
    businessSlug: string | null;
    businessName: string | null;
    businessContacts: ContactFields;
}>> {
    const { supabase, userId, bizId, business } = params;
    const [{ data: isSuper }, { data: branches, error }] = await Promise.all([
        supabase.rpc('is_super_admin'),
        supabase.from('branches').select('id,name,address,is_active').eq('biz_id', bizId).order('name'),
    ]);
    if (error) return dbFailure('Не удалось загрузить филиалы', error);
    const branchLimit = business?.branch_limit ?? 1;
    // Creating a branch: the business's primary owner or a super admin (as /dashboard/branches/new).
    const canManageBranches = !!isSuper || business?.owner_id === userId;
    return {
        ok: true,
        data: {
            branches: (branches ?? []) as Array<{ id: string; name: string; address: string | null; is_active: boolean | null }>,
            branchLimit,
            isSuperAdmin: !!isSuper,
            canManageBranches,
            canCreateBranch: canManageBranches && (branches?.length ?? 0) < branchLimit,
            businessSlug: business?.slug ?? null,
            businessName: business?.name ?? null,
            businessContacts: contactsOf(business),
        },
    };
}

export type BranchRatingWeights = {
    reviews: number;
    productivity: number;
    loyalty: number;
    discipline: number;
    windowDays: number;
};

/** GET /api/dashboard/branches/[branchId]: what /dashboard/branches/[id] shows. */
export async function loadBranchForEdit(params: {
    supabase: DbClient;
    bizId: string;
    branchId: string;
}): Promise<Result<{
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
    schedule: Array<{ day_of_week: number; intervals: Array<{ start: string; end: string }>; breaks: Array<{ start: string; end: string }> }>;
    ratingWeights: BranchRatingWeights | null;
    isSuperAdmin: boolean;
    bizSlug: string | null;
    bizName: string | null;
    businessContacts: ContactFields;
}>> {
    const { supabase, bizId, branchId } = params;
    const [{ data: isSuper }, { data: branch, error }, { data: ratingConfig }, { data: business, error: businessError }] = await Promise.all([
        supabase.rpc('is_super_admin'),
        supabase
            .from('branches')
            .select('id,name,address,is_active,biz_id,lat,lon,rating_score,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts')
            .eq('id', branchId)
            .eq('biz_id', bizId)
            .maybeSingle(),
        supabase
            .from('rating_global_config')
            .select('staff_reviews_weight, staff_productivity_weight, staff_loyalty_weight, staff_discipline_weight, window_days')
            .eq('is_active', true)
            .order('valid_from', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase
            .from('businesses')
            .select('slug,name,contact_phone,contact_whatsapp,contact_email,website_url')
            .eq('id', bizId)
            .maybeSingle(),
    ]);
    if (error) return dbFailure('Не удалось открыть филиал', error);
    if (businessError) return dbFailure('Не удалось открыть филиал', businessError);
    if (!branch || !business) return { ok: false, error: 'not_found', message: 'Филиал не найден', status: 404 };

    // FE-08: an unread schedule must not look like "closed every day".
    const { data: schedule, error: scheduleError } = await supabase
        .from('branch_working_hours')
        .select('day_of_week, intervals, breaks')
        .eq('biz_id', bizId)
        .eq('branch_id', branch.id)
        .order('day_of_week');
    if (scheduleError) return dbFailure('Не удалось открыть филиал', scheduleError);

    const config = ratingConfig as {
        staff_reviews_weight: number;
        staff_productivity_weight: number;
        staff_loyalty_weight: number;
        staff_discipline_weight: number;
        window_days: number;
    } | null;
    return {
        ok: true,
        data: {
            branch: {
                id: String(branch.id),
                name: String(branch.name),
                address: branch.address ?? null,
                is_active: !!branch.is_active,
                lat: branch.lat ?? null,
                lon: branch.lon ?? null,
                rating_score: branch.rating_score ?? null,
                inherit_business_contacts: branch.inherit_business_contacts !== false,
                ...contactsOf(branch),
            },
            schedule: (schedule ?? []).map((row) => ({
                day_of_week: row.day_of_week,
                intervals: (row.intervals || []) as Array<{ start: string; end: string }>,
                breaks: (row.breaks || []) as Array<{ start: string; end: string }>,
            })),
            ratingWeights: config ? {
                reviews: config.staff_reviews_weight,
                productivity: config.staff_productivity_weight,
                loyalty: config.staff_loyalty_weight,
                discipline: config.staff_discipline_weight,
                windowDays: config.window_days,
            } : null,
            isSuperAdmin: !!isSuper,
            bizSlug: business.slug ?? null,
            bizName: business.name ?? null,
            businessContacts: contactsOf(business),
        },
    };
}

/** GET /api/dashboard/contact-settings: the owner's settings form (public contacts and time zone). */
export async function loadBusinessSettings(params: {
    admin: DbClient;
    bizId: string;
}): Promise<Result<ContactFields & { tz: string }>> {
    const { data, error } = await params.admin
        .from('businesses')
        .select('contact_phone,contact_whatsapp,contact_email,website_url,tz')
        .eq('id', params.bizId)
        .maybeSingle();
    // FE-08: a blank form after a failed read would erase the real contacts on save.
    if (error) return dbFailure('Не удалось загрузить настройки бизнеса', error);
    if (!data) return { ok: false, error: 'not_found', message: 'Бизнес не найден', status: 404 };
    return { ok: true, data: { ...contactsOf(data), tz: getBusinessTimezone(data.tz) } };
}
