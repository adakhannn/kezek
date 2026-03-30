import { runQuickHold } from '@/lib/quickHoldService';

jest.mock('@core-domain/booking', () => ({
    createBookingUseCase: jest.fn(),
}));

jest.mock('@/lib/bookingCommandsSupabase', () => ({
    createSupabaseBookingCommands: jest.fn(() => ({ mocked: true })),
}));

jest.mock('@/lib/repositories', () => ({
    SupabaseBranchRepository: jest.fn(),
}));

const { createBookingUseCase } = require('@core-domain/booking');

describe('quickHoldService', () => {
    test('delegates booking orchestration to domain use case', async () => {
        createBookingUseCase.mockResolvedValue({
            ok: true,
            bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        });

        const result = await runQuickHold(
            {
                supabase: {} as any,
                userId: 'user-id-123',
                notify: jest.fn(),
            },
            {
                biz_id: '11111111-1111-4111-8111-111111111111',
                branch_id: '22222222-2222-4222-8222-222222222222',
                service_id: '33333333-3333-4333-8333-333333333333',
                staff_id: '44444444-4444-4444-8444-444444444444',
                start_at: '2026-03-21T10:00:00Z',
            },
        );

        expect(createBookingUseCase).toHaveBeenCalled();
        expect(result).toEqual({
            ok: true,
            bookingId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        });
    });
});
