import type { ReactElement } from 'react';

import CabinetBookingsPage from '@/app/cabinet/bookings/page';
import DashboardHome from '@/app/dashboard/page';
import BusinessSettingsPage from '@/app/dashboard/settings/page';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { readLegacyScheduleContext } from '@/lib/scheduling/legacyContext';

jest.mock('@/components/LoadFailedNotice', () => ({ LoadFailedNotice: () => null }));
jest.mock('@/app/cabinet/ClientCabinet', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/bookings/BookingsPageClient', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/dashboard/components/DashboardHomeClient', () => ({ DashboardHomeClient: () => null }));
jest.mock('@/app/dashboard/settings/BusinessContactSettingsForm', () => ({ BusinessContactSettingsForm: () => null }));
jest.mock('@/app/_components/i18n/server', () => ({ getServerLocale: async () => 'ru', getT: () => (key: string) => key }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/authBiz', () => ({ getBizContextForManagers: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/staffApplicationApprovalService', () => ({ isBusinessOwner: jest.fn(async () => true) }));
jest.mock('@/lib/staffApplicationSummary', () => ({ loadStaffApplicationSummary: jest.fn(async () => ({ pending: 0 })) }));

const { getBizContextForManagers } = jest.requireMock('@/lib/authBiz');
const { createSupabaseServerClient } = jest.requireMock('@/lib/supabaseHelpers');
const { getServiceClient } = jest.requireMock('@/lib/supabaseService');
const { logError } = jest.requireMock('@/lib/log');

const dbError = { code: '57014', message: 'canceling statement due to statement timeout' };

/** A PostgREST-like builder: every filter returns itself; awaiting or maybeSingle gives the result. */
function query(result: { data?: unknown; count?: number | null; error?: unknown }) {
    const settled = { data: result.data ?? null, count: result.count ?? null, error: result.error ?? null };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'in', 'gte', 'lte', 'or', 'order', 'limit', 'neq', 'returns']) builder[method] = jest.fn(() => builder);
    builder.maybeSingle = jest.fn(async () => settled);
    builder.single = jest.fn(async () => settled);
    builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(settled).then(resolve);
    return builder;
}

const isFailedNotice = (element: unknown) => (element as ReactElement).type === LoadFailedNotice;

// FE-08: a failed load was rendered as an empty state - blank contacts (saving them erases the
// real ones), "no upcoming bookings" (inviting a duplicate booking), zero KPIs with onboarding.
describe('server pages answer a failed load with an error and a retry', () => {
    beforeEach(() => jest.clearAllMocks());

    test('business contacts: no blank form after a failed read', async () => {
        const supabase = { rpc: jest.fn(async () => ({ data: false, error: null })) };
        getBizContextForManagers.mockResolvedValue({ supabase, userId: 'u1', bizId: 'b1', business: { name: 'Салон' } });
        getServiceClient.mockReturnValue({ from: jest.fn(() => query({ error: dbError })) });

        const element = await BusinessSettingsPage();

        expect(isFailedNotice(element)).toBe(true);
        expect(logError).toHaveBeenCalledWith('BusinessSettingsPage', 'Failed to load business contacts', expect.objectContaining({ bizId: 'b1' }));
    });

    test('client bookings: an error, not "no upcoming bookings"', async () => {
        createSupabaseServerClient.mockResolvedValue({
            auth: { getUser: async () => ({ data: { user: { id: 'client-1' } } }) },
            from: jest.fn()
                .mockReturnValueOnce(query({ error: dbError }))
                .mockReturnValueOnce(query({ data: [] })),
        });

        const element = await CabinetBookingsPage();

        expect(isFailedNotice(element)).toBe(true);
    });

    test('dashboard home: unknown counts are not zeros and do not start onboarding', async () => {
        const supabase = {
            from: jest.fn((table: string) => (table === 'services' ? query({ error: dbError }) : query({ count: 3 }))),
        };
        getBizContextForManagers.mockResolvedValue({ supabase, bizId: 'b1', userId: 'u1', business: { tz: 'Asia/Bishkek', name: 'Салон' } });

        const element = await DashboardHome();

        expect(isFailedNotice(element)).toBe(true);
        expect(logError).toHaveBeenCalledWith('DashboardHome', 'Failed to count dashboard records', expect.objectContaining({ table: 'services' }));
    });

    test('legacy schedule: a failed read is reported, not "not configured" every day', async () => {
        getServiceClient.mockReturnValue({
            from: jest.fn((table: string) => (table === 'staff_schedule_rules' ? query({ error: dbError }) : query({ data: [], count: 0 }))),
        });

        await expect(readLegacyScheduleContext('b1', 's1', 'branch-1')).resolves.toMatchObject({ failed: true });

        getServiceClient.mockReturnValue({ from: jest.fn(() => query({ data: [], count: 0 })) });
        await expect(readLegacyScheduleContext('b1', 's1', 'branch-1')).resolves.toMatchObject({ failed: false, hasRegularSchedule: false });
    });
});
