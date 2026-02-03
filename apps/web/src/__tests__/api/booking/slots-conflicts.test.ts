/**
 * Edge‑кейсы для слотов и временных переводов (get_free_slots_service_day_v2 через useSlotsLoader)
 *
 * Здесь мы не дергаем сам RPC, а проверяем клиентскую фильтрацию и обработку конфликтов:
 *  - слоты не возвращаются для другого мастера;
 *  - слоты из другого филиала отсекаются;
 *  - для временного перевода принимаются только слоты временного филиала;
 *  - при "конфликтной" ошибке от RPC пользователь видит человеко‑понятное сообщение.
 */

import { act, renderHook } from '@testing-library/react';

import { useSlotsLoader } from '@/app/b/[slug]/hooks/useSlotsLoader';

// Мокаем supabase client, performance и переводчик
jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        rpc: jest.fn(),
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

describe('useSlotsLoader – фильтрация слотов и конфликтные кейсы', () => {
    const supabase = require('@/lib/supabaseClient').supabase as { rpc: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('отфильтровывает слоты других мастеров и филиалов', async () => {
        const dayStr = '2026-01-27';
        const bizId = 'biz-1';
        const branchId = 'branch-1';
        const staffId = 'staff-1';
        const serviceId = 'service-1';

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
            useSlotsLoader({
                bizId,
                branchId,
                staffId,
                serviceId,
                dayStr,
            }),
        );

        // запускаем загрузку
        await act(async () => {
            await result.current.reload();
        });

        expect(supabase.rpc).toHaveBeenCalled();
        // Должен остаться только один слот (для нужного мастера и филиала)
        expect(result.current.slots).toHaveLength(1);
        expect(result.current.slots[0]).toMatchObject({ staff_id: staffId, branch_id: branchId });
    });

    test('при временном переводе принимает только слоты временного филиала', async () => {
        const dayStr = '2026-01-27';
        const bizId = 'biz-1';
        const branchId = 'home-branch';
        const tempBranchId = 'temp-branch';
        const staffId = 'staff-1';
        const serviceId = 'service-1';

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
            useSlotsLoader({
                bizId,
                branchId,
                staffId,
                serviceId,
                dayStr,
                temporaryTransfers: [
                    {
                        staff_id: staffId,
                        branch_id: tempBranchId,
                        date: dayStr,
                    },
                ],
            }),
        );

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.slots).toHaveLength(1);
        expect(result.current.slots[0]).toMatchObject({ branch_id: tempBranchId });
    });

    test('при ошибке с текстом \"conflict\" показывает человеко‑понятное сообщение', async () => {
        const dayStr = '2026-01-27';
        const bizId = 'biz-1';
        const branchId = 'branch-1';
        const staffId = 'staff-1';
        const serviceId = 'service-1';

        supabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'schedule conflict detected' },
        });

        const { result } = renderHook(() =>
            useSlotsLoader({
                bizId,
                branchId,
                staffId,
                serviceId,
                dayStr,
            }),
        );

        await act(async () => {
            await result.current.reload();
        });

        expect(result.current.slots).toHaveLength(0);
        expect(result.current.error).toContain('конфликт');
    });
}


