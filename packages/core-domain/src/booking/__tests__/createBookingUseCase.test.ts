import { createBookingUseCase } from '../useCases';
import type { BranchRepository } from '../../ports';

describe('booking/createBookingUseCase', () => {
    const params = {
        biz_id: 'biz-1',
        branch_id: 'branch-1',
        service_id: 'service-1',
        staff_id: 'staff-1',
        start_at: '2026-03-19T10:00:00+05:00',
    };

    function makeDeps() {
        const branchRepository: jest.Mocked<BranchRepository> = {
            findActiveById: jest.fn(),
            findFirstActiveByBizId: jest.fn(),
        };

        const commands = {
            holdSlot: jest.fn(),
            confirmBooking: jest.fn(),
            cancelBooking: jest.fn(),
        };

        const notifications = {
            send: jest.fn(),
        };

        return { branchRepository, commands, notifications };
    }

    test('uses explicitly selected active branch and confirms booking', async () => {
        const { branchRepository, commands, notifications } = makeDeps();

        branchRepository.findActiveById.mockResolvedValue({ id: 'branch-1' });
        commands.holdSlot.mockResolvedValue('booking-1');
        commands.confirmBooking.mockResolvedValue();
        notifications.send.mockResolvedValue();

        const result = await createBookingUseCase(
            { branchRepository, commands, notifications },
            params,
        );

        expect(result).toEqual({ ok: true, bookingId: 'booking-1' });
        expect(branchRepository.findActiveById).toHaveBeenCalledWith({
            bizId: 'biz-1',
            branchId: 'branch-1',
        });
        expect(commands.holdSlot).toHaveBeenCalledWith({
            bizId: 'biz-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            staffId: 'staff-1',
            startAt: '2026-03-19T10:00:00+05:00',
        });
        expect(commands.confirmBooking).toHaveBeenCalledWith('booking-1');
        expect(notifications.send).toHaveBeenCalledWith('booking-1', 'confirm');
    });

    test('falls back to first active branch when branch_id is not provided', async () => {
        const { branchRepository, commands, notifications } = makeDeps();

        branchRepository.findFirstActiveByBizId.mockResolvedValue({ id: 'branch-fallback' });
        commands.holdSlot.mockResolvedValue('booking-2');
        commands.confirmBooking.mockResolvedValue();
        notifications.send.mockResolvedValue();

        const result = await createBookingUseCase(
            { branchRepository, commands, notifications },
            { ...params, branch_id: null },
        );

        expect(result).toEqual({ ok: true, bookingId: 'booking-2' });
        expect(branchRepository.findFirstActiveByBizId).toHaveBeenCalledWith('biz-1');
        expect(commands.holdSlot).toHaveBeenCalledWith(
            expect.objectContaining({
                branchId: 'branch-fallback',
            }),
        );
    });

    test('returns domain error when selected branch is inactive or missing', async () => {
        const { branchRepository, commands, notifications } = makeDeps();

        branchRepository.findActiveById.mockResolvedValue(null);

        const result = await createBookingUseCase(
            { branchRepository, commands, notifications },
            params,
        );

        expect(result).toEqual({
            ok: false,
            error: {
                kind: 'BRANCH_NOT_FOUND_OR_INACTIVE',
                message: 'Branch not found or inactive',
            },
        });
        expect(commands.holdSlot).not.toHaveBeenCalled();
        expect(commands.confirmBooking).not.toHaveBeenCalled();
        expect(notifications.send).not.toHaveBeenCalled();
    });

    test('returns domain error when business has no active branches', async () => {
        const { branchRepository, commands, notifications } = makeDeps();

        branchRepository.findFirstActiveByBizId.mockResolvedValue(null);

        const result = await createBookingUseCase(
            { branchRepository, commands, notifications },
            { ...params, branch_id: undefined },
        );

        expect(result).toEqual({
            ok: false,
            error: {
                kind: 'NO_ACTIVE_BRANCH_FOR_BIZ',
                message: 'No active branch for business',
            },
        });
        expect(commands.holdSlot).not.toHaveBeenCalled();
        expect(commands.confirmBooking).not.toHaveBeenCalled();
        expect(notifications.send).not.toHaveBeenCalled();
    });
});
