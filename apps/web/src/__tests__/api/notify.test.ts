import { POST } from '@/app/api/notify/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from './testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkBookingBelongsToBusiness } from '@/lib/authCheck';
import { getResendApiKey } from '@/lib/env';
import { BookingDataService } from '@/lib/notifications/BookingDataService';
import { NotificationOrchestrator } from '@/lib/notifications/NotificationOrchestrator';
import { createSupabaseClients } from '@/lib/supabaseHelpers';

jest.mock('@/lib/env', () => ({
    getResendApiKey: jest.fn(() => 'test-resend-key'),
    getEmailFrom: jest.fn(() => 'noreply@example.com'),
}));

jest.mock('@/lib/log', () => ({
    logDebug: jest.fn(),
    logError: jest.fn(),
}));

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/authCheck', () => ({
    checkBookingBelongsToBusiness: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        normal: {},
    },
}));

jest.mock('@/lib/notifications/BookingDataService', () => ({
    BookingDataService: jest.fn(),
}));

jest.mock('@/lib/notifications/NotificationOrchestrator', () => ({
    NotificationOrchestrator: jest.fn(),
}));

const BOOKING_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const MANAGER_ID = '33333333-3333-4333-8333-333333333333';
const BIZ_ID = '44444444-4444-4444-8444-444444444444';

describe('/api/notify', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();
    const mockBooking = {
        id: BOOKING_ID,
        status: 'hold',
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600000).toISOString(),
        client_id: CLIENT_ID,
        client_phone: '+996555123456',
        client_name: 'Test Client',
        client_email: 'client@example.com',
        services: [{ name_ru: 'Test Service', duration_min: 60, price_from: 1000, price_to: 1500 }],
        staff: [{ full_name: 'Test Staff', email: 'staff@example.com', phone: '+996555654321', user_id: 'staff-user-id' }],
        biz: { name: 'Test Business', email_notify_to: ['admin@example.com'], slug: 'test', address: 'Test Address', phones: ['+996555000000'], owner_id: 'owner-id' },
        branches: [{ name: 'Test Branch', address: 'Branch Address' }],
    };
    const bookingDataServiceMock = {
        getBookingById: jest.fn(),
        getOwnerEmailFromBusiness: jest.fn(),
    };
    const orchestratorMock = {
        sendNotifications: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (getResendApiKey as jest.Mock).mockReturnValue('test-resend-key');

        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: mockSupabase,
            admin: mockAdmin,
        });
        (BookingDataService as jest.Mock).mockImplementation(() => bookingDataServiceMock);
        (NotificationOrchestrator as jest.Mock).mockImplementation(() => orchestratorMock);

        bookingDataServiceMock.getBookingById.mockResolvedValue(mockBooking);
        bookingDataServiceMock.getOwnerEmailFromBusiness.mockResolvedValue('owner@example.com');
        orchestratorMock.sendNotifications.mockResolvedValue({
            emailsSent: 2,
            whatsappSent: 1,
            telegramSent: 0,
        });

        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: CLIENT_ID } },
            error: null,
        });
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: BIZ_ID });
        (checkBookingBelongsToBusiness as jest.Mock).mockResolvedValue({ belongs: true });
    });

    test('returns 400 when type is missing', async () => {
        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'validation');
    });

    test('returns 401 when user is unauthenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'hold', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 401, 'auth');
    });

    test('returns 404 when booking is not found', async () => {
        bookingDataServiceMock.getBookingById.mockResolvedValue(null);

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'hold', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 404, 'not_found');
    });

    test('sends notifications for booking owner', async () => {
        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'hold', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(BookingDataService).toHaveBeenCalledWith(mockAdmin);
        expect(NotificationOrchestrator).toHaveBeenCalledWith(
            mockSupabase,
            mockAdmin,
            expect.objectContaining({
                apiKey: 'test-resend-key',
                from: 'noreply@example.com',
                replyTo: 'owner@example.com',
            }),
        );
        expect(orchestratorMock.sendNotifications).toHaveBeenCalledWith(mockBooking, 'hold');
        expect(data.sent).toBe(2);
        expect(data.whatsappSent).toBe(1);
        expect(data.telegramSent).toBe(0);
    });

    test('allows business manager to notify booking from same business', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: MANAGER_ID } },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'confirm', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(getBizContextForManagers).toHaveBeenCalled();
        expect(checkBookingBelongsToBusiness).toHaveBeenCalledWith(BOOKING_ID, BIZ_ID);
        expect(orchestratorMock.sendNotifications).toHaveBeenCalledWith(mockBooking, 'confirm');
        expect(data.sent).toBe(2);
    });

    test('returns 403 when manager has no access to booking business', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: MANAGER_ID } },
            error: null,
        });
        (checkBookingBelongsToBusiness as jest.Mock).mockResolvedValue({ belongs: false });

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'hold', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 403, 'forbidden');
    });

    test('returns 500 when resend api key is missing', async () => {
        (getResendApiKey as jest.Mock).mockImplementation(() => {
            throw new Error('RESEND_API_KEY is not set');
        });

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'hold', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 500, 'internal');
    });

    test('continues without owner reply-to when owner email lookup fails', async () => {
        bookingDataServiceMock.getOwnerEmailFromBusiness.mockResolvedValue(null);

        const req = createMockRequest('http://localhost/api/notify', {
            method: 'POST',
            body: { type: 'cancel', booking_id: BOOKING_ID },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(NotificationOrchestrator).toHaveBeenCalledWith(
            mockSupabase,
            mockAdmin,
            expect.objectContaining({
                replyTo: undefined,
            }),
        );
        expect(orchestratorMock.sendNotifications).toHaveBeenCalledWith(mockBooking, 'cancel');
        expect(data.sent).toBe(2);
    });
});
