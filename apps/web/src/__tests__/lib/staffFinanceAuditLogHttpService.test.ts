jest.mock('@/lib/withManagerAndStaffContext', () => ({
    withManagerAndStaffContext: jest.fn(),
}));

jest.mock('@/lib/staffFinanceAuditLogService', () => ({
    loadStaffFinanceAuditLog: jest.fn(),
}));

import { runStaffFinanceAuditLogHttp } from '@/lib/staffFinanceAuditLogHttpService';
import { loadStaffFinanceAuditLog } from '@/lib/staffFinanceAuditLogService';
import { withManagerAndStaffContext } from '@/lib/withManagerAndStaffContext';

describe('staffFinanceAuditLogHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates through manager/staff context and returns entries', async () => {
        (withManagerAndStaffContext as jest.Mock).mockImplementation(
            async (_req, _context, _opts, handler) =>
                handler({
                    admin: { from: jest.fn() },
                    bizId: 'biz-1',
                    staffId: 'staff-1',
                }),
        );
        (loadStaffFinanceAuditLog as jest.Mock).mockResolvedValue({
            ok: true,
            entries: [{ id: 'entry-1' }],
        });

        const response = await runStaffFinanceAuditLogHttp(
            new Request('http://localhost/api/dashboard/staff/staff-1/finance/audit-log'),
            { params: { id: 'staff-1' } },
        );
        const body = await response.json();

        expect(loadStaffFinanceAuditLog).toHaveBeenCalledWith({
            admin: expect.any(Object),
            bizId: 'biz-1',
            staffId: 'staff-1',
        });
        expect(response.status).toBe(200);
        expect(body.data.entries).toHaveLength(1);
    });
});
