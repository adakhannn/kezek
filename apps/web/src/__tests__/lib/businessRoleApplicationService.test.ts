import {
    canBusinessManagerApproveRole,
    submitBusinessRoleApplication,
} from '@/lib/businessRoleApplicationService';

describe('businessRoleApplicationService role policy', () => {
    test.each(['admin', 'manager'] as const)('rejects new %s applications', async (requestedRole) => {
        const admin = { from: jest.fn() };

        const result = await submitBusinessRoleApplication({
            admin,
            user: { id: 'user-1' },
            input: {
                biz_id: 'biz-1',
                requested_role: requestedRole,
                message: 'test',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            code: 'unsupported_role',
            message: 'Сейчас можно отправить заявку только на роль владельца или сотрудника.',
        });
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('business owners can approve only staff applications', () => {
        expect(canBusinessManagerApproveRole('staff')).toBe(true);
        expect(canBusinessManagerApproveRole('owner')).toBe(false);
        expect(canBusinessManagerApproveRole('admin')).toBe(false);
        expect(canBusinessManagerApproveRole('manager')).toBe(false);
    });
});
