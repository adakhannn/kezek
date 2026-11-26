const mockContext = jest.fn();
const mockServiceClient = jest.fn();
const mockIsOwner = jest.fn();
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: () => mockContext() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: () => mockServiceClient() }));
jest.mock('@/lib/staffApplicationApprovalService', () => ({ isBusinessOwner: (...args: unknown[]) => mockIsOwner(...args) }));

import { runBusinessSettingsReadHttp, runServicesOverviewHttp } from '@/lib/dashboardCatalogReadHttpService';
import {
    groupServicesForManagement,
    loadBranchesOverview,
    loadBranchForEdit,
    loadBusinessSettings,
    loadServiceForEdit,
    type ServiceRow,
} from '@/lib/dashboardCatalogReadService';
import type { DbClient } from '@/lib/supabaseTypes';

type Rows = Record<string, Record<string, unknown>[]>;

/** A tiny PostgREST stand-in: eq filters, maybeSingle, rpc is_super_admin, optional failing tables. */
function database(rows: Rows, options: { superAdmin?: boolean; failing?: string[] } = {}) {
    const db = {
        rpc: jest.fn(async () => ({ data: !!options.superAdmin, error: null })),
        from: jest.fn((table: string) => {
            const filters: [string, unknown][] = [];
            const result = () => {
                if (options.failing?.includes(table)) return { data: null, error: { message: `${table} failed` } };
                return { data: (rows[table] ?? []).filter((row) => filters.every(([k, v]) => row[k] === v)), error: null };
            };
            const query = {
                select: jest.fn(() => query),
                eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
                order: jest.fn(() => query),
                limit: jest.fn(() => query),
                maybeSingle: jest.fn(async () => {
                    const { data, error } = result();
                    return { data: data?.[0] ?? null, error };
                }),
                then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
            };
            return query;
        }),
    };
    return db as unknown as DbClient & { rpc: jest.Mock };
}

const service = (id: string, branch_id: string, active: boolean, name_ru = 'Стрижка'): ServiceRow & { biz_id: string } => ({
    id, biz_id: 'biz-1', branch_id, active, name_ru, name_ky: null, name_en: null, duration_min: 30, price_from: 100, price_to: 200,
});

beforeEach(() => jest.clearAllMocks());

describe('groupServicesForManagement (one grouping for the page and the app)', () => {
    test('groups copies by name, keeps fully hidden services, drops hidden copies of active ones', () => {
        const list = groupServicesForManagement([
            service('a1', 'b1', true), service('a2', 'b2', true), service('a3', 'b3', false),
            service('h1', 'b2', false, 'Борода'),
        ], '');
        expect(list).toEqual([
            expect.objectContaining({ name_ru: 'Стрижка', first_id: 'a1', branch_ids: ['b1', 'b2'], active: true }),
            expect.objectContaining({ name_ru: 'Борода', first_id: 'h1', branch_ids: ['b2'], active: false }),
        ]);
        expect(groupServicesForManagement([service('a1', 'b1', true), service('a2', 'b2', true)], 'b2'))
            .toEqual([expect.objectContaining({ first_id: 'a2', branch_ids: ['b2'] })]);
    });
});

describe('GET /api/dashboard/services', () => {
    test('answers the grouped list, the active branches and the business; ?branch filters', async () => {
        const db = database({
            services: [service('a1', 'b1', true), service('a2', 'b2', true)],
            branches: [{ id: 'b1', name: 'Центр', biz_id: 'biz-1', is_active: true }, { id: 'b3', name: 'Закрыт', biz_id: 'biz-1', is_active: false }],
        });
        mockContext.mockResolvedValue({ supabase: db, bizId: 'biz-1', business: { name: 'Low Fade', city: null } });
        const response = await runServicesOverviewHttp(new Request('http://localhost/api/dashboard/services?branch=b2'));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.data.branches).toEqual([{ id: 'b1', name: 'Центр', biz_id: 'biz-1', is_active: true }]);
        expect(body.data.services).toEqual([expect.objectContaining({ first_id: 'a2', branch_ids: ['b2'] })]);
        expect(body.data.bizName).toBe('Low Fade');
    });

    test('a failed read is a 500, never an empty list (FE-08)', async () => {
        mockContext.mockResolvedValue({ supabase: database({}, { failing: ['branches'] }), bizId: 'biz-1', business: null });
        const response = await runServicesOverviewHttp(new Request('http://localhost/api/dashboard/services'));
        expect(response.status).toBe(500);
    });
});

describe('loaders', () => {
    test('service for edit: other business is not found; branches of same-visibility copies', async () => {
        const db = database({
            services: [service('s1', 'b1', true), service('s2', 'b2', true), service('s3', 'b3', false)],
            branches: [{ id: 'b1', name: 'Центр', biz_id: 'biz-1', is_active: true }],
        });
        const found = await loadServiceForEdit({ admin: db, bizId: 'biz-1', serviceId: 's1' });
        expect(found.ok && found.data.serviceBranchIds).toEqual(['b1', 'b2']);
        const missing = await loadServiceForEdit({ admin: db, bizId: 'biz-2', serviceId: 's1' });
        expect(missing).toMatchObject({ ok: false, status: 404 });
    });

    test('branches overview: the primary owner may create within the limit; a manager may not', async () => {
        const db = database({ branches: [{ id: 'b1', name: 'Центр', address: null, is_active: true, biz_id: 'biz-1' }] });
        const business = { name: 'Low Fade', slug: 'low-fade', owner_id: 'owner', branch_limit: 2, contact_phone: '+996555000111' };
        const owner = await loadBranchesOverview({ supabase: db, userId: 'owner', bizId: 'biz-1', business });
        expect(owner).toMatchObject({ ok: true, data: { canCreateBranch: true, canManageBranches: true, branchLimit: 2, businessSlug: 'low-fade' } });
        expect(owner.ok && owner.data.businessContacts.contact_phone).toBe('+996555000111');
        const manager = await loadBranchesOverview({ supabase: db, userId: 'manager', bizId: 'biz-1', business });
        expect(manager).toMatchObject({ ok: true, data: { canCreateBranch: false, canManageBranches: false } });
        const full = await loadBranchesOverview({ supabase: db, userId: 'owner', bizId: 'biz-1', business: { ...business, branch_limit: 1 } });
        expect(full).toMatchObject({ ok: true, data: { canCreateBranch: false, canManageBranches: true } });
    });

    test('branch for edit: schedule, rating weights, contacts; an unread schedule is an error', async () => {
        const rows: Rows = {
            branches: [{ id: 'b1', biz_id: 'biz-1', name: 'Центр', address: 'Чуй 1', is_active: true, lat: 42.8, lon: 74.6, rating_score: 71.5,
                contact_phone: null, contact_whatsapp: null, contact_email: null, website_url: null, inherit_business_contacts: null }],
            rating_global_config: [{ is_active: true, staff_reviews_weight: 40, staff_productivity_weight: 30, staff_loyalty_weight: 20, staff_discipline_weight: 10, window_days: 30 }],
            businesses: [{ id: 'biz-1', slug: 'low-fade', name: 'Low Fade', contact_phone: '+996555000111' }],
            branch_working_hours: [{ biz_id: 'biz-1', branch_id: 'b1', day_of_week: 1, intervals: [{ start: '09:00', end: '18:00' }], breaks: null }],
        };
        const result = await loadBranchForEdit({ supabase: database(rows), bizId: 'biz-1', branchId: 'b1' });
        expect(result).toMatchObject({ ok: true, data: {
            branch: { id: 'b1', inherit_business_contacts: true, rating_score: 71.5 },
            schedule: [{ day_of_week: 1, intervals: [{ start: '09:00', end: '18:00' }], breaks: [] }],
            ratingWeights: { reviews: 40, windowDays: 30 },
            bizSlug: 'low-fade',
            isSuperAdmin: false,
        } });
        expect(await loadBranchForEdit({ supabase: database(rows), bizId: 'biz-1', branchId: 'other' })).toMatchObject({ status: 404 });
        expect(await loadBranchForEdit({ supabase: database(rows, { failing: ['branch_working_hours'] }), bizId: 'biz-1', branchId: 'b1' }))
            .toMatchObject({ ok: false, status: 500 });
    });

    test('business settings resolve the time zone', async () => {
        const db = database({ businesses: [{ id: 'biz-1', contact_phone: null, contact_whatsapp: null, contact_email: 'a@b.kg', website_url: null, tz: null }] });
        expect(await loadBusinessSettings({ admin: db, bizId: 'biz-1' }))
            .toEqual({ ok: true, data: { contact_phone: null, contact_whatsapp: null, contact_email: 'a@b.kg', website_url: null, tz: 'Asia/Bishkek' } });
    });
});

describe('GET /api/dashboard/contact-settings', () => {
    test('only the owner or a super admin reads the settings', async () => {
        const db = database({ businesses: [{ id: 'biz-1', tz: 'Asia/Almaty' }] });
        mockContext.mockResolvedValue({ supabase: db, userId: 'manager', bizId: 'biz-1' });
        mockServiceClient.mockReturnValue(db);
        mockIsOwner.mockResolvedValue(false);
        expect((await runBusinessSettingsReadHttp()).status).toBe(403);

        mockIsOwner.mockResolvedValue(true);
        const response = await runBusinessSettingsReadHttp();
        expect(response.status).toBe(200);
        expect((await response.json()).data.tz).toBe('Asia/Almaty');
    });
});
