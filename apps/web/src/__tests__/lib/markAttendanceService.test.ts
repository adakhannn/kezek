import { runMarkAttendance } from '@/lib/markAttendanceService';

jest.mock('@/lib/performance', () => ({
    measurePerformance: jest.fn((_operation, fn) => fn()),
}));

describe('markAttendanceService', () => {
    const mockAdmin = {
        from: jest.fn(() => mockAdmin),
        select: jest.fn(() => mockAdmin),
        eq: jest.fn(() => mockAdmin),
        maybeSingle: jest.fn(),
        rpc: jest.fn(),
        update: jest.fn(() => mockAdmin),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns forbidden when booking belongs to another business', async () => {
        mockAdmin.maybeSingle.mockResolvedValueOnce({
            data: {
                id: 'booking-id',
                biz_id: 'other-biz-id',
                start_at: new Date(Date.now() - 86400000).toISOString(),
                status: 'confirmed',
            },
            error: null,
        });

        const result = await runMarkAttendance({
            admin: mockAdmin,
            bookingId: 'booking-id',
            bizId: 'test-biz-id',
            attended: true,
        });

        expect(result).toEqual({
            ok: false,
            statusCode: 403,
            errorType: 'forbidden',
            message: 'Доступ запрещен',
        });
    });
});

