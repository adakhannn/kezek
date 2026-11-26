import { resolveBusinessTimeZone } from '@shared-client/timezone';
import { formatInTimeZone } from 'date-fns-tz';

import { listManagedBusinessRoles, managerAccessToBusiness } from '@/lib/businessManagerAccess';
import type { DbTableClient } from '@/lib/supabaseTypes';
import { dayBoundsInTz } from '@/lib/time';

/**
 * The business feed of the mobile app (O1): the businesses the caller manages and their bookings
 * of today and after today. Every read runs with the service role, only after the caller's identity
 * (Bearer or cookie) and their management of the business (managerAccessToBusiness) are checked.
 * Configuration and finance stay on the website.
 */

export type ManagedBusinessDto = {
    id: string;
    name: string;
    slug: string | null;
    address: string | null;
    phones: string[] | null;
    tz: string;
    role: 'owner' | 'admin' | 'manager';
};

type ServiceNames = { name_ru: string | null; name_ky: string | null; name_en: string | null };

export type ManagerBookingDto = {
    id: string;
    status: 'hold' | 'confirmed' | 'paid' | 'no_show' | 'cancelled';
    start_at: string;
    end_at: string;
    client_name: string | null;
    client_phone: string | null;
    service: ServiceNames | null;
    staff_name: string | null;
    branch_name: string | null;
};

export type ManagerBookingsScope = 'today' | 'upcoming';

export type ManagerBookingsQuery = { bizId: string; scope: ManagerBookingsScope; limit: number; offset: number };

export type ManagerBookingsPage = { offset: number; limit: number; has_more: boolean; next_offset: number | null };

type Failure = { ok: false; error: 'validation' | 'forbidden' | 'not_found' | 'internal'; message: string; status: 400 | 403 | 404 | 500 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MANAGER_BOOKINGS_DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;
const MAX_OFFSET = 10_000;

function intParam(value: string | null, fallback: number, min: number, max: number): number {
    if (value === null || value === '') return fallback;
    const number = Number(value);
    return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

/** `?bizId=<uuid>&scope=today|upcoming&limit=1..50&offset=0..`: null when bizId or scope is invalid. */
export function parseManagerBookingsQuery(params: URLSearchParams): ManagerBookingsQuery | null {
    const bizId = params.get('bizId') ?? '';
    const scope = params.get('scope');
    if (!UUID.test(bizId) || (scope !== 'today' && scope !== 'upcoming')) return null;
    return {
        bizId,
        scope,
        limit: intParam(params.get('limit'), MANAGER_BOOKINGS_DEFAULT_LIMIT, 1, MAX_LIMIT),
        offset: intParam(params.get('offset'), 0, 0, MAX_OFFSET),
    };
}

/** The managed businesses, by name; owner first when the same business has several rows. */
export async function listManagedBusinesses({ admin, userId }: { admin: DbTableClient; userId: string }):
    Promise<{ ok: true; data: ManagedBusinessDto[] } | Failure> {
    const roles = await listManagedBusinessRoles(admin, userId);
    if (roles.size === 0) return { ok: true, data: [] };
    const { data, error } = await admin.from('businesses')
        .select('id, name, slug, address, phones, tz')
        .in('id', [...roles.keys()])
        .order('name', { ascending: true });
    if (error) return { ok: false, error: 'internal', status: 500, message: 'Не удалось загрузить ваши бизнесы' };
    return {
        ok: true,
        data: (data ?? []).map((row: { id: string; name: string; slug: string | null; address: string | null; phones: string[] | null; tz: string | null }) => ({
            id: row.id, name: row.name, slug: row.slug ?? null, address: row.address ?? null, phones: row.phones ?? null,
            tz: resolveBusinessTimeZone(row.tz), role: roles.get(row.id) ?? 'manager',
        })),
    };
}

/** [start, end) of the scope in the business time zone: today, or everything after today. */
export function managerBookingsWindow(scope: ManagerBookingsScope, tz: string, now: Date): { from: string; before: string | null } {
    const today = dayBoundsInTz(formatInTimeZone(now, tz, 'yyyy-MM-dd'), tz);
    return scope === 'today'
        ? { from: today.start.toISOString(), before: today.end.toISOString() }
        : { from: today.end.toISOString(), before: null };
}

type BookingRow = {
    id: string; status: ManagerBookingDto['status']; start_at: string; end_at: string;
    client_id: string | null; client_name: string | null; client_phone: string | null;
    service: ServiceNames | ServiceNames[] | null;
    staff: { full_name: string | null } | { full_name: string | null }[] | null;
    branch: { name: string | null } | { name: string | null }[] | null;
};

const one = <T,>(value: T | T[] | null | undefined): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

/**
 * One page of the business's not-cancelled bookings in the scope, by start time ascending (the
 * day's order), id as tie-break; one extra row decides `has_more`. A booking without a typed
 * client name shows the client's profile name, like the website's list.
 */
export async function listManagerBookings({ admin, userId, query, now = new Date() }: {
    admin: DbTableClient; userId: string; query: ManagerBookingsQuery; now?: Date;
}): Promise<{ ok: true; data: ManagerBookingDto[]; page: ManagerBookingsPage; timezone: string } | Failure> {
    const access = await managerAccessToBusiness(admin, userId, query.bizId);
    if (access === 'missing') return { ok: false, error: 'not_found', status: 404, message: 'Бизнес не найден' };
    if (access !== 'manager') return { ok: false, error: 'forbidden', status: 403, message: 'Нет доступа к этому бизнесу' };

    const { data: business, error: businessError } = await admin.from('businesses').select('tz').eq('id', query.bizId).maybeSingle();
    if (businessError) return { ok: false, error: 'internal', status: 500, message: 'Не удалось загрузить записи бизнеса' };
    const timezone = resolveBusinessTimeZone((business as { tz?: string | null } | null)?.tz);
    const window = managerBookingsWindow(query.scope, timezone, now);

    let request = admin.from('bookings')
        .select(`id, status, start_at, end_at, client_id, client_name, client_phone,
            service:services!bookings_service_id_fkey ( name_ru, name_ky, name_en ),
            staff:staff!bookings_staff_id_fkey ( full_name ),
            branch:branches!bookings_branch_id_fkey ( name )`)
        .eq('biz_id', query.bizId)
        .neq('status', 'cancelled')
        .gte('start_at', window.from);
    if (window.before) request = request.lt('start_at', window.before);
    const { data, error } = await request
        .order('start_at', { ascending: true })
        .order('id', { ascending: true })
        .range(query.offset, query.offset + query.limit);
    if (error) return { ok: false, error: 'internal', status: 500, message: 'Не удалось загрузить записи бизнеса' };

    const rows = ((data ?? []) as unknown as BookingRow[]);
    const hasMore = rows.length > query.limit;
    const pageRows = rows.slice(0, query.limit);

    const missingNames = [...new Set(pageRows.filter(row => !row.client_name?.trim() && row.client_id).map(row => String(row.client_id)))];
    const profileNames = new Map<string, string>();
    if (missingNames.length > 0) {
        const { data: profiles, error: profileError } = await admin.from('profiles').select('id, full_name').in('id', missingNames);
        if (profileError) return { ok: false, error: 'internal', status: 500, message: 'Не удалось загрузить записи бизнеса' };
        for (const profile of (profiles ?? []) as Array<{ id: string; full_name: string | null }>) {
            if (profile.full_name?.trim()) profileNames.set(profile.id, profile.full_name.trim());
        }
    }

    return {
        ok: true,
        timezone,
        page: { offset: query.offset, limit: query.limit, has_more: hasMore, next_offset: hasMore ? query.offset + query.limit : null },
        data: pageRows.map(row => ({
            id: row.id,
            status: row.status,
            start_at: row.start_at,
            end_at: row.end_at,
            client_name: row.client_name?.trim() || (row.client_id ? profileNames.get(String(row.client_id)) ?? null : null),
            client_phone: row.client_phone ?? null,
            service: one(row.service),
            staff_name: one(row.staff)?.full_name ?? null,
            branch_name: one(row.branch)?.name ?? null,
        })),
    };
}
