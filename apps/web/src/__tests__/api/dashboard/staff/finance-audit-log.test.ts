import { GET } from '@/app/api/dashboard/staff/[id]/finance/audit-log/route';

import { createMockRequest, expectErrorResponse, expectSuccessResponse } from '../../testHelpers';

jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffFinanceAuditLogService', () => ({
    loadStaffFinanceAuditLog: jest.fn(),
}));

const { withManagerAndStaffContext } = require('@/lib/withManagerAndStaffContext');
const { loadStaffFinanceAuditLog } = require('@/lib/staffFinanceAuditLogService');

describe('/api/dashboard/staff/[id]/finance/audit-log', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns entries from audit log service', async () => {
        withManagerAndStaffContext.mockImplementation(
            async (_req: Request, _context: unknown, _opts: unknown, handler: Function) =>
                handler({
                    admin: { mocked: true },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                }),
        );
        loadStaffFinanceAuditLog.mockResolvedValue({
            ok: true,
            entries: [
                {
                    id: 'entry-1',
                    changed_at: '2026-03-27T10:00:00.000Z',
                    changed_by_user_id: 'user-1',
                    changed_by_name: 'Ada Manager',
                    field_changes: [],
                    message: null,
                },
            ],
        });

        const response = await GET(
            createMockRequest('http://localhost/api/dashboard/staff/staff-1/finance/audit-log'),
            { params: Promise.resolve({ id: 'staff-1' }) },
        );
        const data = await expectSuccessResponse(response);

        expect(data.data.entries).toHaveLength(1);
    });

    test('returns internal error when audit service fails', async () => {
        withManagerAndStaffContext.mockImplementation(
            async (_req: Request, _context: unknown, _opts: unknown, handler: Function) =>
                handler({
                    admin: { mocked: true },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                }),
        );
        loadStaffFinanceAuditLog.mockResolvedValue({
            ok: false,
            error: 'internal',
            message: 'db failed',
            status: 500,
        });

        const response = await GET(
            createMockRequest('http://localhost/api/dashboard/staff/staff-1/finance/audit-log'),
            { params: Promise.resolve({ id: 'staff-1' }) },
        );
        const data = await expectErrorResponse(response, 500, 'internal');

        expect(data.message).toBe('db failed');
    });
});
