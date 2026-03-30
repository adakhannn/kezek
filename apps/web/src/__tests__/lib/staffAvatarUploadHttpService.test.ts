jest.mock('@/lib/authBiz', () => ({
    getStaffContext: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffAvatarUploadService', () => ({
    runStaffAvatarUpload: jest.fn(),
}));

import { getStaffContext } from '@/lib/authBiz';
import { runStaffAvatarUploadHttp } from '@/lib/staffAvatarUploadHttpService';
import { runStaffAvatarUpload } from '@/lib/staffAvatarUploadService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffAvatarUploadHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContext as jest.Mock).mockResolvedValue({ staffId: 'staff-id', bizId: 'biz-id' });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(), storage: {} });
    });

    test('delegates upload request to avatar upload service', async () => {
        (runStaffAvatarUpload as jest.Mock).mockResolvedValue({
            ok: true,
            data: { url: 'https://cdn/avatar.jpg' },
        });

        const formData = new FormData();
        formData.set('file', new File(['abc'], 'avatar.jpg', { type: 'image/jpeg' }));
        const response = await runStaffAvatarUploadHttp(
            new Request('http://localhost/api/staff/avatar/upload', {
                method: 'POST',
                body: formData,
            }),
        );
        const body = await response.json();

        expect(runStaffAvatarUpload).toHaveBeenCalledWith({
            admin: expect.any(Object),
            staffId: 'staff-id',
            bizId: 'biz-id',
            file: expect.any(File),
        });
        expect(response.status).toBe(200);
        expect(body.data.url).toBe('https://cdn/avatar.jpg');
    });
});
