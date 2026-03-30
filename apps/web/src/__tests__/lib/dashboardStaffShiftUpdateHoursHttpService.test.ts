import { runDashboardStaffShiftUpdateHoursHttp } from '@/lib/dashboardStaffShiftUpdateHoursHttpService';

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

jest.mock('@/lib/dashboardStaffShiftUpdateHoursService', () => ({
    updateDashboardShiftHours: jest.fn(),
}));

const { getRouteParamRequired } = require('@/lib/routeParams');
const { withManagerContext } = require('@/lib/withManagerContext');
const { updateDashboardShiftHours } = require('@/lib/dashboardStaffShiftUpdateHoursService');

describe('dashboardStaffShiftUpdateHoursHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        getRouteParamRequired.mockResolvedValue('shift-id');
        withManagerContext.mockImplementation(
            async (_req: Request, _scope: string, handler: Function) =>
                handler({
                    admin: { mocked: true },
                    bizId: 'biz-1',
                }),
        );
    });

    test('returns validation error for invalid json body', async () => {
        const req = new Request('http://localhost/api/dashboard/staff-shifts/shift-id/update-hours', {
            method: 'POST',
            body: '{',
            headers: { 'content-type': 'application/json' },
        });

        const res = await runDashboardStaffShiftUpdateHoursHttp(req, {
            params: Promise.resolve({ id: 'shift-id' }),
        });
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
    });

    test('returns validation error for hours outside allowed range', async () => {
        const req = new Request('http://localhost/api/dashboard/staff-shifts/shift-id/update-hours', {
            method: 'POST',
            body: JSON.stringify({ hours_worked: 100 }),
            headers: { 'content-type': 'application/json' },
        });

        const res = await runDashboardStaffShiftUpdateHoursHttp(req, {
            params: Promise.resolve({ id: 'shift-id' }),
        });
        const data = await res.json();

        expect(res.status).toBe(400);
        expect(data.error).toBe('validation');
    });

    test('delegates successful update to service and returns payload', async () => {
        updateDashboardShiftHours.mockResolvedValue({
            ok: true,
            data: {
                shift: { id: 'shift-id', hours_worked: 8.33 },
            },
        });

        const req = new Request('http://localhost/api/dashboard/staff-shifts/shift-id/update-hours', {
            method: 'POST',
            body: JSON.stringify({ hours_worked: 8.333 }),
            headers: { 'content-type': 'application/json' },
        });

        const res = await runDashboardStaffShiftUpdateHoursHttp(req, {
            params: Promise.resolve({ id: 'shift-id' }),
        });
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(updateDashboardShiftHours).toHaveBeenCalledWith({
            admin: { mocked: true },
            bizId: 'biz-1',
            shiftId: 'shift-id',
            hoursWorked: 8.33,
        });
        expect(data.data.shift.hours_worked).toBe(8.33);
    });
});
