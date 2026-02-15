// apps/web/src/__tests__/lib/notifications/BookingDataService.test.ts

import { createClient } from '@supabase/supabase-js';

import { BookingDataService } from '@/lib/notifications/BookingDataService';
import type { BookingRow } from '@/lib/notifications/types';

// Мокаем Supabase клиент
jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

// Мокаем логирование
jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
    logWarn: jest.fn(),
}));

describe('BookingDataService', () => {
    let mockAdmin: ReturnType<typeof createClient>;
    let service: BookingDataService;

    beforeEach(() => {
        // Создаем мок Supabase клиента
        mockAdmin = {
            from: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn(),
            auth: {
                admin: {
                    getUserById: jest.fn(),
                },
            },
        } as unknown as ReturnType<typeof createClient>;

        service = new BookingDataService(mockAdmin);
    });

    describe('getBookingById', () => {
        it('должен успешно получить данные бронирования', async () => {
            const mockBooking: BookingRow = {
                id: 'booking-123',
                status: 'confirmed',
                start_at: '2024-01-01T10:00:00Z',
                end_at: '2024-01-01T11:00:00Z',
                created_at: '2024-01-01T09:00:00Z',
                client_id: 'client-123',
                client_phone: '+996555123456',
                client_name: 'Test Client',
                client_email: 'client@test.com',
                services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 2000 }],
                staff: [{ full_name: 'Test Staff', email: 'staff@test.com', phone: '+996555654321', user_id: 'staff-123' }],
                biz: [{ name: 'Test Business', email_notify_to: ['admin@test.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-123' }],
                branches: [{ name: 'Test Branch', address: 'Test Branch Address' }],
            };

            (mockAdmin.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: mockBooking,
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await service.getBookingById('booking-123');

            expect(result).toEqual(mockBooking);
            expect(mockAdmin.from).toHaveBeenCalledWith('bookings');
        });

        it('должен вернуть null если бронирование не найдено', async () => {
            (mockAdmin.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: null,
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await service.getBookingById('non-existent');

            expect(result).toBeNull();
        });

        it('должен выбросить ошибку при ошибке базы данных', async () => {
            (mockAdmin.from as jest.Mock).mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        maybeSingle: jest.fn().mockResolvedValue({
                            data: null,
                            error: { message: 'Database error' },
                        }),
                    }),
                }),
            });

            await expect(service.getBookingById('booking-123')).rejects.toThrow('Failed to fetch booking: Database error');
        });
    });

    describe('getOwnerEmail', () => {
        it('должен успешно получить email владельца', async () => {
            (mockAdmin.auth.admin.getUserById as jest.Mock).mockResolvedValue({
                data: {
                    user: {
                        email: 'owner@test.com',
                    },
                },
            });

            const result = await service.getOwnerEmail('owner-123');

            expect(result).toBe('owner@test.com');
            expect(mockAdmin.auth.admin.getUserById).toHaveBeenCalledWith('owner-123');
        });

        it('должен вернуть null если email не найден', async () => {
            (mockAdmin.auth.admin.getUserById as jest.Mock).mockResolvedValue({
                data: {
                    user: null,
                },
            });

            const result = await service.getOwnerEmail('owner-123');

            expect(result).toBeNull();
        });

        it('должен вернуть null при ошибке', async () => {
            (mockAdmin.auth.admin.getUserById as jest.Mock).mockRejectedValue(new Error('Auth error'));

            const result = await service.getOwnerEmail('owner-123');

            expect(result).toBeNull();
        });
    });

    describe('getOwnerEmailFromBusiness', () => {
        it('должен получить email владельца из бизнеса (объект)', async () => {
            const biz = {
                name: 'Test Business',
                owner_id: 'owner-123',
            };

            (mockAdmin.auth.admin.getUserById as jest.Mock).mockResolvedValue({
                data: {
                    user: {
                        email: 'owner@test.com',
                    },
                },
            });

            const result = await service.getOwnerEmailFromBusiness(biz);

            expect(result).toBe('owner@test.com');
        });

        it('должен получить email владельца из бизнеса (массив)', async () => {
            const biz = [{
                name: 'Test Business',
                owner_id: 'owner-123',
            }];

            (mockAdmin.auth.admin.getUserById as jest.Mock).mockResolvedValue({
                data: {
                    user: {
                        email: 'owner@test.com',
                    },
                },
            });

            const result = await service.getOwnerEmailFromBusiness(biz);

            expect(result).toBe('owner@test.com');
        });

        it('должен вернуть null если owner_id отсутствует', async () => {
            const biz = {
                name: 'Test Business',
            };

            const result = await service.getOwnerEmailFromBusiness(biz);

            expect(result).toBeNull();
            expect(mockAdmin.auth.admin.getUserById).not.toHaveBeenCalled();
        });
    });
});

