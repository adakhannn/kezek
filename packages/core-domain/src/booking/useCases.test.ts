import { createBookingUseCase, decideMarkAttendanceUseCase } from './useCases';

import type { BranchRepository, BookingRepository } from '../ports';
import type { BookingCommandsPort, BookingNotificationPort } from './useCases';

describe('core-domain/booking/useCases', () => {
    test('createBookingUseCase возвращает ошибку, если филиал не найден или неактивен', async () => {
        const branchRepository: BranchRepository = {
            // @ts-expect-error не все методы нужны для теста
            findFirstActiveByBizId: jest.fn(),
            // @ts-expect-error не все методы нужны для теста
            findActiveById: jest.fn().mockResolvedValue(null),
        };

        const commands: BookingCommandsPort = {
            holdSlot: jest.fn(),
            confirmBooking: jest.fn(),
            cancelBooking: jest.fn(),
        };

        const result = await createBookingUseCase(
            { branchRepository, commands },
            {
                biz_id: 'biz-1',
                branch_id: 'branch-1',
                service_id: 'service-1',
                staff_id: 'staff-1',
                start_at: '2025-01-01T10:00:00.000Z',
                client_id: null,
                client_name: null,
                client_phone: null,
                comment: null,
                source: 'manual',
                meta: null,
            },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe('BRANCH_NOT_FOUND_OR_INACTIVE');
        }
        expect(commands.holdSlot).not.toHaveBeenCalled();
    });

    test('createBookingUseCase создаёт, подтверждает и шлёт уведомление при успешном сценарии (одна услуга)', async () => {
        const branchRepository: BranchRepository = {
            // @ts-expect-error не все методы нужны для теста
            findActiveById: jest.fn().mockResolvedValue({ id: 'branch-1' }),
            // @ts-expect-error не все методы нужны для теста
            findFirstActiveByBizId: jest.fn(),
        };

        const commands: BookingCommandsPort = {
            holdSlot: jest.fn().mockResolvedValue('booking-123'),
            confirmBooking: jest.fn().mockResolvedValue(undefined),
            cancelBooking: jest.fn().mockResolvedValue(undefined),
        };

        const notifications: BookingNotificationPort = {
            send: jest.fn().mockResolvedValue(undefined),
        };

        const result = await createBookingUseCase(
            { branchRepository, commands, notifications },
            {
                biz_id: 'biz-1',
                branch_id: 'branch-1',
                service_id: 'service-1',
                staff_id: 'staff-1',
                start_at: '2025-01-01T10:00:00.000Z',
                client_id: 'client-1',
                client_name: 'Test Client',
                client_phone: '+996555000000',
                comment: null,
                source: 'manual',
                meta: null,
            },
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.bookingId).toBe('booking-123');
        }

        expect(commands.holdSlot).toHaveBeenCalledWith({
            bizId: 'biz-1',
            branchId: 'branch-1',
            serviceId: 'service-1',
            staffId: 'staff-1',
            startAt: '2025-01-01T10:00:00.000Z',
        });
        expect(commands.confirmBooking).toHaveBeenCalledWith('booking-123');
        expect(notifications.send).toHaveBeenCalledWith('booking-123', 'confirm');
    });

    test('createBookingUseCase использует holdComplexSlot, если передан массив services и порт его поддерживает', async () => {
        const branchRepository: BranchRepository = {
            // @ts-expect-error не все методы нужны для теста
            findActiveById: jest.fn().mockResolvedValue({ id: 'branch-1' }),
            // @ts-expect-error не все методы нужны для теста
            findFirstActiveByBizId: jest.fn(),
        };

        const holdSlot = jest.fn();
        const holdComplexSlot = jest.fn().mockResolvedValue('booking-complex-1');
        const confirmBooking = jest.fn().mockResolvedValue(undefined);

        const commands: BookingCommandsPort = {
            holdSlot,
            // @ts-expect-error optional method in interface
            holdComplexSlot,
            confirmBooking,
            cancelBooking: jest.fn().mockResolvedValue(undefined),
        };

        const result = await createBookingUseCase(
            { branchRepository, commands },
            {
                biz_id: 'biz-1',
                branch_id: 'branch-1',
                service_id: 'service-main',
                staff_id: 'staff-1',
                start_at: '2025-01-01T10:00:00.000Z',
                // services: два элемента, чтобы проверить маппинг и order_index по умолчанию
                services: [
                    { service_id: 'service-1', duration_min: 30 },
                    { service_id: 'service-2', duration_min: 45, order_index: 5 },
                ],
            } as any,
        );

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.bookingId).toBe('booking-complex-1');
        }

        expect(holdComplexSlot).toHaveBeenCalledWith({
            bizId: 'biz-1',
            branchId: 'branch-1',
            staffId: 'staff-1',
            startAt: '2025-01-01T10:00:00.000Z',
            services: [
                { service_id: 'service-1', duration_min: 30, order_index: 0 },
                { service_id: 'service-2', duration_min: 45, order_index: 5 },
            ],
        });
        expect(holdSlot).not.toHaveBeenCalled();
        expect(confirmBooking).toHaveBeenCalledWith('booking-complex-1');
    });

    test('decideMarkAttendanceUseCase возвращает BOOKING_NOT_IN_PAST, если дата в будущем', async () => {
        const bookingRepository: BookingRepository = {
            // @ts-expect-error не все методы нужны для теста
            findById: jest.fn().mockResolvedValue({
                id: 'booking-1',
                biz_id: 'biz-1',
                status: 'hold',
                start_at: '2025-01-01T10:00:00.000Z',
            }),
        };

        const now = () => new Date('2024-12-31T10:00:00.000Z');

        const result = await decideMarkAttendanceUseCase(
            { bookingRepository, now },
            {
                bookingId: 'booking-1',
                bizId: 'biz-1',
                attended: true,
            },
        );

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('BOOKING_NOT_IN_PAST');
        }
    });

    test('decideMarkAttendanceUseCase помечает как paid/no_show и решает про промо', async () => {
        const bookingRepository: BookingRepository = {
            // @ts-expect-error не все методы нужны для теста
            findById: jest.fn().mockResolvedValue({
                id: 'booking-1',
                biz_id: 'biz-1',
                status: 'confirmed',
                start_at: '2024-01-01T10:00:00.000Z',
            }),
        };

        const now = () => new Date('2024-01-02T10:00:00.000Z');

        const attendedResult = await decideMarkAttendanceUseCase(
            { bookingRepository, now },
            {
                bookingId: 'booking-1',
                bizId: 'biz-1',
                attended: true,
            },
        );

        expect(attendedResult.ok).toBe(true);
        if (attendedResult.ok) {
            expect(attendedResult.newStatus).toBe('paid');
            expect(attendedResult.applyPromotion).toBe(true);
        }

        const noShowResult = await decideMarkAttendanceUseCase(
            { bookingRepository, now },
            {
                bookingId: 'booking-1',
                bizId: 'biz-1',
                attended: false,
            },
        );

        expect(noShowResult.ok).toBe(true);
        if (noShowResult.ok) {
            expect(noShowResult.newStatus).toBe('no_show');
            expect(noShowResult.applyPromotion).toBe(false);
        }
    });
}

