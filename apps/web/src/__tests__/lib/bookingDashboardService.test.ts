jest.mock('@/lib/internalBookingClient', () => ({ postInternalBooking: jest.fn() }));
import { postInternalBooking } from '@/lib/internalBookingClient';
jest.mock('@core-domain/booking', () => ({
    cancelBookingUseCase: jest.fn(),
    confirmBookingUseCase: jest.fn(),
}));

jest.mock('@/lib/supabaseClient', () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn(),
    },
}));

jest.mock('@/lib/log', () => ({
    logError: jest.fn(),
}));

import {
    cancelBookingUseCase,
    confirmBookingUseCase,
} from '@core-domain/booking';

import {
    cancelBooking,
    confirmBooking,
    createInternalBooking,
    createInternalComplexBooking,
    getFreeSlotsForComplexDay,
    getFreeSlotsForServiceDay,
} from '@/lib/bookingDashboardService';
import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

describe('bookingDashboardService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('delegates confirm action to core-domain use case', async () => {
        (confirmBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await confirmBooking('booking-confirm-1');

        expect(confirmBookingUseCase).toHaveBeenCalledWith(
            {
                commands: expect.objectContaining({
                    holdSlot: expect.any(Function),
                    confirmBooking: expect.any(Function),
                    cancelBooking: expect.any(Function),
                }),
            },
            'booking-confirm-1',
        );
    });

    it('delegates cancel action to core-domain use case', async () => {
        (cancelBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await cancelBooking('booking-cancel-1');

        expect(cancelBookingUseCase).toHaveBeenCalledWith(
            {
                commands: expect.objectContaining({
                    holdSlot: expect.any(Function),
                    confirmBooking: expect.any(Function),
                    cancelBooking: expect.any(Function),
                }),
            },
            'booking-cancel-1',
        );
    });

    it('throws for unsupported holdSlot dashboard action', async () => {
        (confirmBookingUseCase as jest.Mock).mockResolvedValue(undefined);

        await confirmBooking('booking-hold-check');
        const commands = (confirmBookingUseCase as jest.Mock).mock.calls[0][0].commands;

        await expect(commands.holdSlot()).rejects.toThrow(
            'holdSlot is not supported in booking dashboard actions',
        );
    });

    it('uses confirm_booking rpc in dashboard commands', async () => {
        (confirmBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.confirmBooking('booking-confirm-rpc');
        });
        (supabase.rpc as jest.Mock).mockResolvedValue({
            error: null,
        });

        await confirmBooking('booking-confirm-rpc');

        expect(supabase.rpc).toHaveBeenCalledWith('confirm_booking', {
            p_booking_id: 'booking-confirm-rpc',
        });
    });

    it('logs and rethrows confirm rpc errors', async () => {
        const rpcError = { message: 'confirm failed' };
        (confirmBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => {
            await commands.confirmBooking('booking-confirm-error');
        });
        (supabase.rpc as jest.Mock).mockResolvedValue({
            error: rpcError,
        });

        await expect(confirmBooking('booking-confirm-error')).rejects.toEqual(rpcError);
        expect(logError).toHaveBeenCalledWith(
            'BookingDashboardService',
            'confirm_booking error',
            expect.objectContaining({
                bookingId: 'booking-confirm-error',
                error: rpcError,
            }),
        );
    });

    it.each(['Staff no longer assigned', 'BOOKING_FINANCIAL_REVERSAL_REQUIRED', 'permission denied'])('keeps cancellation failure without direct table writes: %s', async message => {
        const error = { message };
        (cancelBookingUseCase as jest.Mock).mockImplementation(async ({ commands }) => commands.cancelBooking('cancel-1'));
        (supabase.rpc as jest.Mock).mockResolvedValue({ error });
        await expect(cancelBooking('cancel-1')).rejects.toEqual(error);
        expect(supabase.from).not.toHaveBeenCalled();
    });

    it('creates internal booking through durable HTTP client', async () => {
        (postInternalBooking as jest.Mock).mockResolvedValue('booking-created-1');

        const bookingId = await createInternalBooking({
            bizId: 'biz-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            staffId: 'staff-1',
            startAtISO: '2026-03-26T10:00:00Z',
            minutes: 90,
            clientId: 'client-1',
            clientName: 'Client',
            clientPhone: '+996700000001',
        });

        expect(bookingId).toBe('booking-created-1');
        expect(postInternalBooking).toHaveBeenCalledWith({
            mode: 'simple',
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            service_id: 'service-1',
            staff_id: 'staff-1',
            start_at: '2026-03-26T10:00:00Z',
            duration_min: 90,
            client_id: 'client-1',
            client_name: 'Client',
            client_phone: '+996700000001',
        });
    });

    it('logs and rethrows createInternalBooking HTTP errors', async () => {
        const error = new Error('create_internal_booking failed');
        (postInternalBooking as jest.Mock).mockRejectedValue(error);

        await expect(
            createInternalBooking({
                bizId: 'biz-1',
                branchId: 'branch-1',
                serviceId: 'service-1',
                staffId: 'staff-1',
                startAtISO: '2026-03-26T10:00:00Z',
                minutes: 90,
                clientId: 'client-1',
                clientName: 'Client',
                clientPhone: '+996700000001',
            }),
        ).rejects.toThrow('create_internal_booking failed');
    });

    it('maps complex booking services payload and uses default order indexes', async () => {
        (postInternalBooking as jest.Mock).mockResolvedValue('complex-booking-1');

        const bookingId = await createInternalComplexBooking({
            bizId: 'biz-1',
            branchId: 'branch-1',
            staffId: 'staff-1',
            startAtISO: '2026-03-26T10:00:00Z',
            services: [
                { serviceId: 'service-1', durationMin: 30 },
                { serviceId: 'service-2', durationMin: 45, orderIndex: 7 },
            ],
            clientId: null,
            clientName: 'Guest',
            clientPhone: '+996700000002',
            clientEmail: null,
        });

        expect(bookingId).toBe('complex-booking-1');
        expect(postInternalBooking).toHaveBeenCalledWith({
            mode: 'complex',
            biz_id: 'biz-1',
            branch_id: 'branch-1',
            staff_id: 'staff-1',
            start_at: '2026-03-26T10:00:00Z',
            services: [
                { service_id: 'service-1', duration_min: 30, order_index: 0 },
                { service_id: 'service-2', duration_min: 45, order_index: 7 },
            ],
            client_id: null,
            client_name: 'Guest',
            client_phone: '+996700000002',
            client_email: null,
        });
    });

    it('logs and rethrows createInternalComplexBooking HTTP errors', async () => {
        const error = new Error('create_internal_complex_booking failed');
        (postInternalBooking as jest.Mock).mockRejectedValue(error);

        await expect(
            createInternalComplexBooking({
                bizId: 'biz-1',
                branchId: 'branch-1',
                staffId: 'staff-1',
                startAtISO: '2026-03-26T10:00:00Z',
                services: [{ serviceId: 'service-1', durationMin: 30 }],
                clientId: null,
                clientName: 'Guest',
                clientPhone: '+996700000002',
                clientEmail: null,
            }),
        ).rejects.toThrow('create_internal_complex_booking failed');
    });

    it('returns service-day free slots from rpc', async () => {
        const slots = [
            {
                staff_id: 'staff-1',
                branch_id: 'branch-1',
                start_at: '2026-03-26T10:00:00Z',
                end_at: '2026-03-26T10:30:00Z',
            },
        ];
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: slots,
            error: null,
        });

        await expect(
            getFreeSlotsForServiceDay({
                bizId: 'biz-1',
                staffId: 'staff-1',
                serviceId: 'service-1',
                day: '2026-03-26',
            }),
        ).resolves.toEqual(slots);

        expect(supabase.rpc).toHaveBeenCalledWith('get_free_slots_service_day_v2', {
            p_biz_id: 'biz-1',
            p_service_id: 'service-1',
            p_day: '2026-03-26',
            p_per_staff: 400,
            p_step_min: 15,
            p_staff_id: 'staff-1',
        });
    });

    it.each(['any', ''])('rejects unscoped dashboard slot request %s before RPC', async staffId => {
        await expect(getFreeSlotsForServiceDay({ bizId: 'biz-1', serviceId: 'service-1', day: '2035-01-01', staffId })).rejects.toThrow('USE_PAGED_SLOTS');
        expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('returns empty list when service-day rpc data is null', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        await expect(
            getFreeSlotsForServiceDay({
                bizId: 'biz-1',
                staffId: 'staff-1',
                serviceId: 'service-1',
                day: '2026-03-26',
                perStaff: 10,
                stepMinutes: 10,
            }),
        ).resolves.toEqual([]);
    });

    it('logs and rethrows service-day slot rpc errors', async () => {
        const error = new Error('service slots failed');
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error,
        });

        await expect(
            getFreeSlotsForServiceDay({
                bizId: 'biz-1',
                staffId: 'staff-1',
                serviceId: 'service-1',
                day: '2026-03-26',
            }),
        ).rejects.toThrow('service slots failed');
    });

    it('returns complex-day free slots with explicit branch and duration params', async () => {
        const slots = [
            {
                staff_id: 'staff-2',
                branch_id: 'branch-2',
                start_at: '2026-03-26T11:00:00Z',
                end_at: '2026-03-26T12:15:00Z',
            },
        ];
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: slots,
            error: null,
        });

        await expect(
            getFreeSlotsForComplexDay({
                bizId: 'biz-2',
                branchId: 'branch-2',
                staffId: 'staff-2',
                day: '2026-03-26',
                totalDurationMin: 75,
                perStaff: 25,
                stepMinutes: 5,
            }),
        ).resolves.toEqual(slots);

        expect(supabase.rpc).toHaveBeenCalledWith('get_free_slots_complex_day_v1', {
            p_biz_id: 'biz-2',
            p_branch_id: 'branch-2',
            p_staff_id: 'staff-2',
            p_day: '2026-03-26',
            p_duration_min: 75,
            p_step_min: 5,
            p_per_staff: 25,
        });
    });

    it('returns empty list for complex-day rpc with null data and null branch', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error: null,
        });

        await expect(
            getFreeSlotsForComplexDay({
                bizId: 'biz-2',
                branchId: null,
                staffId: 'staff-2',
                day: '2026-03-26',
                totalDurationMin: 75,
            }),
        ).resolves.toEqual([]);
    });

    it('logs and rethrows complex-day slot rpc errors', async () => {
        const error = new Error('complex slots failed');
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error,
        });

        await expect(
            getFreeSlotsForComplexDay({
                bizId: 'biz-2',
                branchId: 'branch-2',
                staffId: 'staff-2',
                day: '2026-03-26',
                totalDurationMin: 75,
            }),
        ).rejects.toThrow('complex slots failed');
    });
});
