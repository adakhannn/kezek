import { POST } from '@/app/api/staff/avatar/upload/route';
import {
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../../testHelpers';

setupApiTestMocks();

import { getStaffContext } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/staff/avatar/upload', () => {
    const mockAdmin = createMockSupabase() as ReturnType<typeof createMockSupabase> & {
        storage?: {
            from: jest.Mock;
        };
    };
    const staffId = '11111111-2222-3333-4444-555555555555';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();

        (getStaffContext as jest.Mock).mockResolvedValue({
            staffId,
            bizId,
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
    });

    test('returns 400 when file is missing', async () => {
        const formData = new FormData();
        const req = new Request('http://localhost/api/staff/avatar/upload', {
            method: 'POST',
            body: formData,
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400);
    });

    test('returns 400 when file is not an image', async () => {
        const formData = new FormData();
        formData.append('file', new File(['content'], 'test.txt', { type: 'text/plain' }));

        const req = new Request('http://localhost/api/staff/avatar/upload', {
            method: 'POST',
            body: formData,
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400);
    });

    test('returns 400 when file exceeds 5MB', async () => {
        const formData = new FormData();
        const largeContent = 'a'.repeat(6 * 1024 * 1024);
        formData.append('file', new File([largeContent], 'large.jpg', { type: 'image/jpeg' }));

        const req = new Request('http://localhost/api/staff/avatar/upload', {
            method: 'POST',
            body: formData,
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400);
    });

    test('uploads avatar successfully', async () => {
        const formData = new FormData();
        formData.append('file', new File(['image content'], 'avatar.jpg', { type: 'image/jpeg' }));

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: null,
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce((() => {
                const updateQuery = {
                    update: jest.fn(),
                    eq: jest.fn(),
                };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({
                        data: null,
                        error: null,
                    });
                return updateQuery;
            })());

        const storageApi = {
            upload: jest.fn().mockResolvedValue({
                data: {
                    path: 'staff-avatars/uploaded-avatar.jpg',
                },
                error: null,
            }),
            getPublicUrl: jest.fn().mockReturnValue({
                data: {
                    publicUrl: 'https://example.com/avatars/staff-avatars/uploaded-avatar.jpg',
                },
            }),
            remove: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };

        mockAdmin.storage = {
            from: jest.fn().mockReturnValue(storageApi),
        };

        const req = new Request('http://localhost/api/staff/avatar/upload', {
            method: 'POST',
            body: formData,
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data.data).toHaveProperty(
            'url',
            'https://example.com/avatars/staff-avatars/uploaded-avatar.jpg',
        );
    });

    test('removes old avatar before uploading a new one', async () => {
        const formData = new FormData();
        formData.append('file', new File(['image content'], 'avatar.jpg', { type: 'image/jpeg' }));

        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: {
                        avatar_url: 'https://example.com/storage/v1/object/public/avatars/staff-avatars/old-avatar.jpg',
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce((() => {
                const updateQuery = {
                    update: jest.fn(),
                    eq: jest.fn(),
                };
                updateQuery.update.mockReturnValue(updateQuery);
                updateQuery.eq
                    .mockImplementationOnce(() => updateQuery)
                    .mockResolvedValueOnce({
                        data: null,
                        error: null,
                    });
                return updateQuery;
            })());

        const storageApi = {
            upload: jest.fn().mockResolvedValue({
                data: {
                    path: 'staff-avatars/uploaded-avatar.jpg',
                },
                error: null,
            }),
            getPublicUrl: jest.fn().mockReturnValue({
                data: {
                    publicUrl: 'https://example.com/avatars/staff-avatars/uploaded-avatar.jpg',
                },
            }),
            remove: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };

        mockAdmin.storage = {
            from: jest.fn().mockReturnValue(storageApi),
        };

        const req = new Request('http://localhost/api/staff/avatar/upload', {
            method: 'POST',
            body: formData,
        });

        const res = await POST(req);
        await expectSuccessResponse(res, 200);

        expect(storageApi.remove).toHaveBeenCalledWith(['staff-avatars/old-avatar.jpg']);
    });
});
