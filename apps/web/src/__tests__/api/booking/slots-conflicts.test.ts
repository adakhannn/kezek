/**
 * Edge‑кейсы для слотов и временных переводов (get_free_slots_service_day_v2 через useSlotsLoader)
 * @jest-environment jsdom
 *
 * Здесь мы не дергаем сам RPC, а проверяем клиентскую фильтрацию и обработку конфликтов:
 *  - слоты не возвращаются для другого мастера;
 *  - слоты из другого филиала отсекаются;
 *  - для временного перевода принимаются только слоты временного филиала;
 *  - при "конфликтной" ошибке от RPC пользователь видит человеко‑понятное сообщение.
 */

import { act, renderHook } from '@testing-library/react';

import { useSlotsLoader } from '@/app/b/[slug]/hooks/useSlotsLoader';

// Мокаем supabase client (rpc + from для staff_schedule_rules и т.д.), performance и переводчик
jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
    },
}));

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((operation: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('next-intl', () => ({
    useTranslations: () => {
        const t = (key: string, fallback?: string) => fallback ?? key;
        return t;
    },
}));

function defaultParams(overrides: Record<string, unknown> = {}) {
    return {
        bizId: 'biz-1',
        branchId: 'branch-1',
        staffId: 'staff-1',
        serviceId: 'service-1',
        dayStr: '2026-01-27',
        servicesFiltered: [{ id: 'service-1' }],
        serviceStaff: [{ service_id: 'service-1', staff_id: 'staff-1' }],
        temporaryTransfers: [] as Array<{ staff_id: string; branch_id: string; date: string }>,
        staff: [{ id: 'staff-1', branch_id: 'branch-1' }],
        t: (key: string, fallback?: string) => fallback ?? key,
        ...overrides,
    };
}

describe('useSlotsLoader – фильтрация слотов и конфликтные кейсы', () => {
    const supabase = require('@/lib/supabaseClient').supabase as { rpc: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('отфильтровывает слоты других мастеров и филиалов', async () => {
        const staffId = 'staff-1';
        const branchId = 'branch-1';
        const now = new Date();
        const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

        // RPC возвращает слоты для разных мастеров и филиалов
        supabase.rpc.mockResolvedValueOnce({
            data: [
                { staff_id: staffId, branch_id: branchId, start_at: future, end_at: future },
                { staff_id: 'other-staff', branch_id: branchId, start_at: future, end_at: future },
                { staff_id: staffId, branch_id: 'other-branch', start_at: future, end_at: future },
            ],
            error: null,
        });

        const { result } = renderHook(() =>
            useSlotsLoader(defaultParams()),
        );

        // ждём debounce (300ms) и срабатывания эффекта загрузки слотов
        await act(async () => {
            await new Promise((r) => setTimeout(r, 400));
        });

        expect(supabase.rpc).toHaveBeenCalled();
        // Должен остаться только один слот (для нужного мастера и филиала)
        expect(result.current.slots).toHaveLength(1);
        expect(result.current.slots[0]).toMatchObject({ staff_id: staffId, branch_id: branchId });
    });

    test('при временном переводе принимает только слоты временного филиала', async () => {
        const staffId = 'staff-1';
        const branchId = 'home-branch';
        const tempBranchId = 'temp-branch';
        const dayStr = '2026-01-27';
        const now = new Date();
        const future = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

        // RPC возвращает слоты с двумя филиалами
        supabase.rpc.mockResolvedValueOnce({
            data: [
                { staff_id: staffId, branch_id: tempBranchId, start_at: future, end_at: future },
                { staff_id: staffId, branch_id: branchId, start_at: future, end_at: future },
            ],
            error: null,
        });

        const { result } = renderHook(() =>
            useSlotsLoader(defaultParams({
                branchId,
                dayStr,
                staff: [{ id: staffId, branch_id: branchId }],
                temporaryTransfers: [{ staff_id: staffId, branch_id: tempBranchId, date: dayStr }],
            })),
        );

        await act(async () => {
            await new Promise((r) => setTimeout(r, 400));
        });

        expect(result.current.slots).toHaveLength(1);
        expect(result.current.slots[0]).toMatchObject({ branch_id: tempBranchId });
    });

    test('при ошибке с текстом "conflict" показывает человеко‑понятное сообщение', async () => {
        supabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'schedule conflict detected' },
        });

        const { result } = renderHook(() =>
            useSlotsLoader(defaultParams()),
        );

        await act(async () => {
            await new Promise((r) => setTimeout(r, 400));
        });

        expect(result.current.slots).toHaveLength(0);
        expect(result.current.error).toContain('конфликт');
    });
});


