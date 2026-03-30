import { runStaffAvatarUpload } from '@/lib/staffAvatarUploadService';

describe('staffAvatarUploadService', () => {
    let admin: any;
    let storageApi: any;

    beforeEach(() => {
        jest.clearAllMocks();

        storageApi = {
            upload: jest.fn().mockResolvedValue({
                data: { path: 'staff-avatars/uploaded-avatar.jpg' },
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

        admin = {
            from: jest.fn(),
            storage: {
                from: jest.fn().mockReturnValue(storageApi),
            },
        };
    });

    test('returns validation error when file is missing', async () => {
        const result = await runStaffAvatarUpload({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
            file: null,
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Файл не предоставлен',
        });
    });

    test('uploads avatar and returns public url', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { avatar_url: null },
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

        const result = await runStaffAvatarUpload({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
            file: new File(['image content'], 'avatar.jpg', { type: 'image/jpeg' }),
        });

        expect(result).toEqual({
            ok: true,
            data: {
                url: 'https://example.com/avatars/staff-avatars/uploaded-avatar.jpg',
            },
        });
        expect(storageApi.upload).toHaveBeenCalled();
    });
});
