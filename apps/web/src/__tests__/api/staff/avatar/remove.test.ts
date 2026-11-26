import { POST } from '@/app/api/staff/avatar/remove/route';
import {
    createMockRequest,
    createMockSupabase,
    expectSuccessResponse,
    expectBusinessScoped,
    recordQueries,
} from '../../testHelpers';

import { getStaffContextForRequest } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/staff/avatar/remove', () => {
    const mockAdmin = createMockSupabase();
    const db = recordQueries(mockAdmin);
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';

    function createSelectStaffQuery(avatarUrl: string | null) {
        const query = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
                data: { avatar_url: avatarUrl },
                error: null,
            }),
        };

        return query;
    }

    function createDoubleEqUpdateQuery() {
        const query = {
            update: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2
                ? Promise.resolve({ data: null, error: null })
                : query;
        });

        return query;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        db.queries.length = 0;

        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ staffId, bizId });
        (getServiceClient as jest.Mock).mockReturnValue(db.client);
    });

    test('removes avatar successfully', async () => {
        const avatarUrl = 'https://example.com/avatars/staff-avatars/avatar.jpg';
        const mockStorage = {
            remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        };

        mockAdmin.storage = {
            from: jest.fn().mockReturnValue(mockStorage),
        };

        mockAdmin.from
            .mockReturnValueOnce(createSelectStaffQuery(avatarUrl))
            .mockReturnValueOnce(createDoubleEqUpdateQuery());

        const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(mockStorage.remove).toHaveBeenCalled();
        expectBusinessScoped(db, 'staff', bizId);
        // The mobile app sends a Bearer token: the context comes from the request, not only cookies.
        expect(getStaffContextForRequest).toHaveBeenCalledWith(req, 'StaffAvatarRemove');
    });

    test('returns success when avatar is already absent', async () => {
        mockAdmin.from.mockReturnValueOnce(createSelectStaffQuery(null));

        const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data).toHaveProperty('message');
    });

    test('continues when storage removal fails', async () => {
        const avatarUrl = 'https://example.com/avatars/staff-avatars/avatar.jpg';
        const mockStorage = {
            remove: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'File not found' },
            }),
        };

        mockAdmin.storage = {
            from: jest.fn().mockReturnValue(mockStorage),
        };

        mockAdmin.from
            .mockReturnValueOnce(createSelectStaffQuery(avatarUrl))
            .mockReturnValueOnce(createDoubleEqUpdateQuery());

        const req = createMockRequest('http://localhost/api/staff/avatar/remove', {
            method: 'POST',
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});
