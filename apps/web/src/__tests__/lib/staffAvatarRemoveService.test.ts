import { runStaffAvatarRemove } from '@/lib/staffAvatarRemoveService';

describe('staffAvatarRemoveService', () => {
    let admin: any;
    let storageApi: any;

    beforeEach(() => {
        jest.clearAllMocks();

        storageApi = {
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

    test('returns success with message when avatar is absent', async () => {
        admin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
                data: { avatar_url: null },
                error: null,
            }),
        });

        const result = await runStaffAvatarRemove({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                message: 'Аватарка не найдена',
            },
        });
    });

    test('removes avatar and clears avatar_url', async () => {
        admin.from
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

        const result = await runStaffAvatarRemove({
            admin,
            staffId: 'staff-id',
            bizId: 'biz-id',
        });

        expect(result).toEqual({ ok: true });
        expect(storageApi.remove).toHaveBeenCalledWith(['staff-avatars/old-avatar.jpg']);
    });
});
