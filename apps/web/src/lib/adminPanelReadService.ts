/**
 * Reads of the super-admin panel (/admin): the same rows the admin pages render on the server and
 * the JSON GET routes under /admin/api/* give the mobile app (one source of truth). Every function
 * takes the service-role client and runs only after the caller is verified as a global super admin.
 */
import { parseAdminUserStats, type AdminUserStats } from '@/lib/adminUserStats';
import { isSupabaseServiceRoleConfigured } from '@/lib/env';
import { readPlatformAdminStates } from '@/lib/platformAdminState';
import type { DbClient } from '@/lib/supabaseTypes';

type AdminClient = DbClient;
type Failure<E extends string> = { ok: false; error: E; message: string | null };

function normRel<T>(rel: T | T[] | null | undefined): T | null {
    if (rel == null) return null;
    return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

/* ------------------------------------------------------------------ home (/admin) */

export const ADMIN_HOME_COUNT_KEYS = ['businesses', 'branches', 'staff', 'services', 'bookings', 'categories'] as const;
export type AdminHomeCountKey = (typeof ADMIN_HOME_COUNT_KEYS)[number];

const COUNT_TABLES: Record<AdminHomeCountKey, 'businesses' | 'branches' | 'staff' | 'services' | 'bookings' | 'categories'> = {
    businesses: 'businesses',
    branches: 'branches',
    staff: 'staff',
    services: 'services',
    bookings: 'bookings',
    categories: 'categories',
};

export type AdminHomeFailure =
    | { source: 'count'; count: AdminHomeCountKey; message: string }
    | { source: 'latestBusinesses' | 'todayBookings'; message: string }
    | { source: 'unexpected'; message: string | null };

export type AdminHomeBusiness = { id: string; name: string; slug: string; created_at: string };

export type AdminTodayBooking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client: string;
    service: string;
    staff: string;
    biz: string;
    bizId: string | null;
    branch: string;
};

type BookingRel = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    client_name: string | null;
    client_phone: string | null;
    services: { name_ru: string } | { name_ru: string }[] | null;
    staff: { full_name: string } | { full_name: string }[] | null;
    businesses: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
    branches: { name: string } | { name: string }[] | null;
};

/** Today on the Bishkek calendar (the admin home's day): [start, end) and its YYYY-MM-DD label. */
export function bishkekDayRange(now = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bishkek',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const ymd = fmt.format(now);
    const start = new Date(`${ymd}T00:00:00+06:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return { startISO: start.toISOString(), endISO: end.toISOString(), label: ymd };
}

/** The environment checks the admin home shows ("Системные проверки"). */
export function adminSystemChecks() {
    return {
        serviceRoleKey: isSupabaseServiceRoleConfigured(),
        siteOrigin: !!process.env.NEXT_PUBLIC_SITE_ORIGIN,
        supabaseKeys: !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
}

export function isAdminDataConfigured(): boolean {
    return !!process.env.NEXT_PUBLIC_SUPABASE_URL && isSupabaseServiceRoleConfigured();
}

function mapTodayBooking(r: BookingRel): AdminTodayBooking {
    const svc = normRel(r.services);
    const stf = normRel(r.staff);
    const biz = normRel(r.businesses);
    const br = normRel(r.branches);
    return {
        id: r.id,
        start_at: r.start_at,
        end_at: r.end_at,
        status: r.status,
        client: r.client_name || r.client_phone || '—',
        service: svc?.name_ru ?? '—',
        staff: stf?.full_name ?? '—',
        biz: biz?.name ?? '—',
        bizId: biz?.id ?? null,
        branch: br?.name ?? '—',
    };
}

/**
 * The admin home: platform counts, the five newest businesses and today's bookings (first 20).
 * A failed part is reported in `failures`; its count stays 0, as the page always showed it.
 */
export async function readAdminHomeSummary(admin: AdminClient, now = new Date()) {
    const day = bishkekDayRange(now);
    const failures: AdminHomeFailure[] = [];
    const counts = Object.fromEntries(ADMIN_HOME_COUNT_KEYS.map((key) => [key, 0])) as Record<AdminHomeCountKey, number>;
    let latestBusinesses: AdminHomeBusiness[] = [];
    let todayBookings: AdminTodayBooking[] = [];

    try {
        const countResults = await Promise.all(
            ADMIN_HOME_COUNT_KEYS.map((key) => admin.from(COUNT_TABLES[key]).select('*', { count: 'exact', head: true })),
        );
        countResults.forEach((result, index) => {
            const key = ADMIN_HOME_COUNT_KEYS[index];
            if (result.error) {
                failures.push({ source: 'count', count: key, message: result.error.message });
                return;
            }
            counts[key] = result.count ?? 0;
        });

        const latest = await admin
            .from('businesses')
            .select('id,name,slug,created_at')
            .order('created_at', { ascending: false })
            .limit(5)
            .returns<AdminHomeBusiness[]>();
        if (latest.error) failures.push({ source: 'latestBusinesses', message: latest.error.message });
        else latestBusinesses = latest.data ?? [];

        const today = await admin
            .from('bookings')
            .select(
                'id,start_at,end_at,status,client_name,client_phone,' +
                    'services(name_ru),' +
                    'staff(full_name),' +
                    'businesses(id,name,slug),' +
                    'branches(name)',
            )
            .gte('start_at', day.startISO)
            .lt('start_at', day.endISO)
            .order('start_at', { ascending: true })
            .limit(20)
            .returns<BookingRel[]>();
        if (today.error) failures.push({ source: 'todayBookings', message: today.error.message });
        else todayBookings = (today.data ?? []).map(mapTodayBooking);
    } catch (error) {
        failures.push({ source: 'unexpected', message: error instanceof Error ? error.message : null });
    }

    return { day, counts, latestBusinesses, todayBookings, failures };
}

/** Today's bookings by status, as the home's chips count them (cancelled and canceled together). */
export function todayStatusCounts(bookings: Pick<AdminTodayBooking, 'status'>[]) {
    const byStatus = bookings.reduce<Record<string, number>>((acc, b) => {
        acc[b.status] = (acc[b.status] ?? 0) + 1;
        return acc;
    }, {});
    return {
        hold: byStatus.hold ?? 0,
        confirmed: byStatus.confirmed ?? 0,
        cancelled: (byStatus.cancelled ?? 0) + (byStatus.canceled ?? 0),
    };
}

/* ------------------------------------------------------------ /admin/businesses */

export type AdminBusinessListItem = {
    id: string;
    slug: string;
    name: string;
    owner_id: string | null;
    created_at: string | null;
    is_approved: boolean | null;
    categories: string[] | null;
    address: string | null;
    owner_name: string | null;
    branches_count: number;
    staff_count: number;
};

type ListClient = Pick<DbClient, 'from'>;

/** A user's display name for the admin lists: full name, else email, else phone, else the id. */
async function readOwnerNames(admin: AdminClient, ownerIds: string[]): Promise<Map<string, string>> {
    const results = await Promise.all(
        ownerIds.map(async (oid) => {
            try {
                const { data, error } = await admin.auth.admin.getUserById(oid);
                if (error || !data?.user) return [oid, oid] as const;
                const meta = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                const display =
                    meta.full_name?.trim() ||
                    data.user.email?.trim() ||
                    (data.user as { phone?: string | null }).phone?.trim() ||
                    oid;
                return [oid, display] as const;
            } catch {
                return [oid, oid] as const;
            }
        }),
    );
    return new Map(results);
}

/**
 * Every business, newest first, with the owner's name and the branch and staff counts.
 * `reader` is the caller's own session client (the list is read under its RLS, as the page did).
 */
export async function readAdminBusinessList(
    reader: ListClient,
    admin: AdminClient,
): Promise<{ ok: true; items: AdminBusinessListItem[] } | Failure<'list' | 'counts'>> {
    const { data: list, error: listErr } = await reader
        .from('businesses')
        .select('id,slug,name,owner_id,created_at,is_approved,categories,address')
        .order('created_at', { ascending: false });
    if (listErr) return { ok: false, error: 'list', message: listErr.message };

    const rows = list ?? [];
    const ownerIds = Array.from(new Set(rows.map((b) => b.owner_id).filter(Boolean))) as string[];
    const owners = ownerIds.length ? await readOwnerNames(admin, ownerIds) : new Map<string, string>();

    const businessIds = rows.map((b) => b.id);
    const [branchesData, staffData] = await Promise.all([
        admin.from('branches').select('biz_id').in('biz_id', businessIds),
        admin.from('staff').select('biz_id').in('biz_id', businessIds),
    ]);
    // FE-08: failed counts are unknown, not 0.
    if (branchesData.error || staffData.error) {
        return { ok: false, error: 'counts', message: branchesData.error?.message ?? staffData.error?.message ?? null };
    }
    const countBy = (items: { biz_id: string }[] | null) => {
        const map = new Map<string, number>();
        (items ?? []).forEach((item) => map.set(item.biz_id, (map.get(item.biz_id) ?? 0) + 1));
        return map;
    };
    const branchesCount = countBy(branchesData.data);
    const staffCount = countBy(staffData.data);

    return {
        ok: true,
        items: rows.map((b) => ({
            ...b,
            owner_name: b.owner_id ? owners.get(b.owner_id) ?? null : null,
            branches_count: branchesCount.get(b.id) ?? 0,
            staff_count: staffCount.get(b.id) ?? 0,
        })),
    };
}

/* -------------------------------------------------------- /admin/businesses/[id] */

export type AdminBusinessRow = {
    id: string;
    name: string;
    slug: string;
    categories: string[] | null;
    owner_id: string | null;
    is_approved: boolean | null;
    created_at: string | null;
    address: string | null;
    phones: string[] | null;
    contact_phone: string | null;
    contact_whatsapp: string | null;
    contact_email: string | null;
    website_url: string | null;
    branch_limit: number;
};

export type AdminUserMini = { id: string; email: string | null; phone: string | null; full_name: string | null };

/** The business card: the row, its counts, the owner and the active categories to choose from. */
export async function readAdminBusinessDetail(admin: AdminClient, id: string) {
    const { data: business, error: businessError } = await admin
        .from('businesses')
        .select('id,name,slug,categories,owner_id,is_approved,created_at,address,phones,contact_phone,contact_whatsapp,contact_email,website_url,branch_limit')
        .eq('id', id)
        .maybeSingle<AdminBusinessRow>();
    if (businessError) return { ok: false as const, error: 'load' as const, message: businessError.message };
    if (!business) return { ok: false as const, error: 'not_found' as const, message: null };

    const [branchesResult, staffResult, servicesResult, bookingsResult, categoriesResult] = await Promise.all([
        admin.from('branches').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('staff').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('services').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('bookings').select('id', { count: 'exact', head: true }).eq('biz_id', id),
        admin.from('categories').select('slug,name_ru,is_active').order('name_ru', { ascending: true }),
    ]);

    let owner: AdminUserMini | null = null;
    if (business.owner_id) {
        const { data, error } = await admin.auth.admin.getUserById(business.owner_id);
        if (!error && data?.user) {
            const metadata = (data.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
            owner = {
                id: data.user.id,
                email: data.user.email ?? null,
                phone: (data.user as { phone?: string | null }).phone ?? null,
                full_name: metadata.full_name?.trim() || null,
            };
        }
    }

    return {
        ok: true as const,
        business,
        counts: {
            branches: branchesResult.count ?? 0,
            staff: staffResult.count ?? 0,
            services: servicesResult.count ?? 0,
            bookings: bookingsResult.count ?? 0,
        },
        owner,
        categoryOptions: (categoriesResult.data ?? [])
            .filter((category) => category.is_active !== false)
            .map((category) => ({ slug: category.slug, name: category.name_ru })),
    };
}

/* ----------------------------------------------- /admin/businesses/[id]/branches */

export type AdminBranchListItem = {
    id: string;
    name: string;
    address: string | null;
    is_active: boolean | null;
    created_at: string | null;
};

export async function readAdminBusinessBranches(
    admin: AdminClient,
    bizId: string,
): Promise<
    | { ok: true; business: { id: string; name: string; branch_limit: number }; branches: AdminBranchListItem[] }
    | Failure<'load' | 'not_found'>
> {
    const [{ data: biz, error: bizError }, { data: branches, error: branchesError }] = await Promise.all([
        admin.from('businesses').select('id,name,branch_limit').eq('id', bizId).maybeSingle(),
        admin
            .from('branches')
            .select('id,name,address,is_active,created_at')
            .eq('biz_id', bizId)
            .order('created_at', { ascending: true }),
    ]);
    // FE-08: a failed read is an error, not "not found" or "no branches yet".
    if (bizError || branchesError) {
        return { ok: false, error: 'load', message: bizError?.message ?? branchesError?.message ?? null };
    }
    if (!biz) return { ok: false, error: 'not_found', message: null };
    return { ok: true, business: biz, branches: branches ?? [] };
}

/* -------------------------------------- /admin/businesses/[id]/branches/[branchId] */

export type AdminScheduleDay = {
    day_of_week: number;
    intervals: Array<{ start: string; end: string }>;
    breaks: Array<{ start: string; end: string }>;
};

/** One branch for the edit form and its working hours (FE-08: unread hours are an error). */
export async function readAdminBranchDetail(admin: AdminClient, bizId: string, branchId: string) {
    const { data: branch, error } = await admin
        .from('branches')
        .select('id,biz_id,name,address,is_active,lat,lon,directory_links,contact_phone,contact_whatsapp,contact_email,website_url,inherit_business_contacts')
        .eq('biz_id', bizId)
        .eq('id', branchId)
        .maybeSingle();
    if (error) return { ok: false as const, error: 'load' as const, message: error.message };
    if (!branch) return { ok: false as const, error: 'not_found' as const, message: null };

    const { data: biz } = await admin.from('businesses').select('id,name').eq('id', bizId).maybeSingle();

    const { data: scheduleData, error: scheduleError } = await admin
        .from('branch_working_hours')
        .select('day_of_week, intervals, breaks')
        .eq('biz_id', bizId)
        .eq('branch_id', branchId)
        .order('day_of_week');
    if (scheduleError) return { ok: false as const, error: 'load' as const, message: scheduleError.message };

    const schedule: AdminScheduleDay[] = (scheduleData || []).map((s) => ({
        day_of_week: s.day_of_week,
        intervals: (s.intervals || []) as Array<{ start: string; end: string }>,
        breaks: (s.breaks || []) as Array<{ start: string; end: string }>,
    }));

    return {
        ok: true as const,
        branch: {
            ...branch,
            is_active: !!branch.is_active,
            lat: branch.lat ?? null,
            lon: branch.lon ?? null,
            directory_links: (branch.directory_links ?? {}) as Record<string, string | null>,
        },
        bizName: biz?.name ?? null,
        schedule,
    };
}

/* ------------------------------------------------- /admin/business-applications */

export type AdminBusinessApplication = {
    id: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    business_name: string | null;
    category: string | null;
    comment: string | null;
    status: string | null;
    applicant_user_id: string | null;
    created_at: string;
    created_business_id: string | null;
    directory_links: Record<string, string | null> | null;
    prior_submission_count: number;
    risk_flags: string[];
};

/**
 * The 200 newest business applications and the active category names by slug and by name
 * (lower case), so an application's free-text category resolves to a known one.
 */
export async function readAdminBusinessApplications(admin: AdminClient) {
    const [{ data: applications, error }, { data: categories, error: categoriesError }] = await Promise.all([
        admin
            .from('business_registration_applications')
            .select('id,contact_name,phone,email,business_name,category,comment,status,applicant_user_id,created_at,created_business_id,directory_links,prior_submission_count,risk_flags')
            .order('created_at', { ascending: false })
            .limit(200),
        admin.from('categories').select('slug,name_ru').eq('is_active', true),
    ]);
    if (error) return { ok: false as const, error: 'load' as const, message: error.message };
    if (categoriesError) return { ok: false as const, error: 'categories' as const, message: categoriesError.message };

    const categoryNames: Record<string, string> = {};
    (categories ?? []).forEach((category) => {
        const slug = typeof category.slug === 'string' ? category.slug.trim() : '';
        const name = typeof category.name_ru === 'string' ? category.name_ru.trim() : '';
        if (!slug || !name) return;
        categoryNames[slug.toLowerCase()] = name;
        categoryNames[name.toLowerCase()] = name;
    });

    return {
        ok: true as const,
        applications: (applications ?? []) as AdminBusinessApplication[],
        categoryNames,
    };
}

/* ------------------------------------------------------------- /admin/users/[id] */

type BizRef = { id: string; name: string; slug: string | null };

export type AdminUserRole = { role_key: string; biz_id: string | null; biz_name: string | null; biz_slug: string | null };

/**
 * One account for the admin card: auth fields, the super-admin flag, owned businesses, its other
 * roles (without super_admin and owner, as the page lists them) and an active suspension.
 */
export async function readAdminUserDetail(admin: AdminClient, actorId: string, userId: string) {
    const { data: got, error: eGet } = await admin.auth.admin.getUserById(userId);
    if (eGet) return { ok: false as const, error: 'account' as const, message: eGet.message };
    const u = got?.user;
    if (!u) return { ok: false as const, error: 'not_found' as const, message: null };

    let isSuper: boolean;
    try {
        isSuper = (await readPlatformAdminStates(admin, actorId, [userId])).get(userId) === true;
    } catch {
        return { ok: false as const, error: 'admin_state' as const, message: null };
    }

    const { data: ownerBusinesses, error: ownerBusinessesError } = await admin
        .from('businesses')
        .select('id,name,slug')
        .eq('owner_id', userId)
        .order('name')
        .returns<BizRef[]>();
    const { data: viewRoles, error: viewRolesError } = await admin
        .from('user_roles_with_user')
        .select('user_id,role_key,biz_id')
        .eq('user_id', userId);
    // FE-08: an admin acting on this account must not see "no roles, not blocked" after a failed read.
    if (ownerBusinessesError || viewRolesError) {
        return { ok: false as const, error: 'load' as const, message: ownerBusinessesError?.message ?? viewRolesError?.message ?? null };
    }

    const bizIds = Array.from(new Set((viewRoles ?? []).map((r) => r.biz_id).filter(Boolean) as string[]));
    const bizMap = new Map<string, { name: string; slug: string | null }>();
    let roleBusinessError: string | null = null;
    if (bizIds.length) {
        const { data: relBiz, error: relBizError } = await admin
            .from('businesses')
            .select('id,name,slug')
            .in('id', bizIds)
            .returns<BizRef[]>();
        // Names are a label only: role badges fall back to the business id.
        if (relBizError) roleBusinessError = relBizError.message;
        (relBiz ?? []).forEach((b) => bizMap.set(b.id, { name: b.name, slug: b.slug ?? null }));
    }

    const roles: AdminUserRole[] = (viewRoles ?? [])
        .filter((r) => r.role_key !== 'super_admin' && r.role_key !== 'owner')
        .map((r) => {
            const b = r.biz_id ? bizMap.get(r.biz_id) : null;
            return { role_key: String(r.role_key), biz_id: r.biz_id ?? null, biz_name: b?.name ?? null, biz_slug: b?.slug ?? null };
        });

    const { data: suspension, error: suspensionError } = await admin
        .from('user_suspensions')
        .select('reason, created_at')
        .eq('user_id', userId)
        .maybeSingle();
    // FE-08: an unread suspension must not show the account as "not blocked".
    if (suspensionError) return { ok: false as const, error: 'load' as const, message: suspensionError.message };

    const meta = (u.user_metadata ?? {}) as Partial<{ full_name: string }>;
    return {
        ok: true as const,
        user: {
            id: u.id,
            email: u.email ?? null,
            phone: (u as { phone?: string | null }).phone ?? null,
            full_name: meta.full_name ?? null,
            last_sign_in_at: u.last_sign_in_at ?? null,
        },
        isSuper,
        ownerBusinesses: ownerBusinesses ?? [],
        roles,
        roleBusinessError,
        suspension: suspension ? { reason: suspension.reason ?? null, created_at: suspension.created_at ?? null } : null,
    };
}

/* ------------------------------------------------------------------ /admin/users */

/** Counts over the whole user directory in one service-only read (ARCH-03); throws on failure. */
export async function readAdminUserStats(admin: AdminClient, actorId: string): Promise<AdminUserStats> {
    const { data, error } = await admin.rpc('admin_user_stats', { p_actor_id: actorId });
    if (error) throw error;
    return parseAdminUserStats(data);
}
