import { updateDashboardShiftHours } from '@/lib/dashboardStaffShiftUpdateHoursService';

const shift = { id: 'shift', biz_id: 'biz', status: 'closed', ledger_revision: 7, total_amount: 1001,
    consumables_amount: 99, percent_master: 60, percent_salon: 40, hourly_rate: 100 };
function setup(patch: Record<string, unknown> = {}, dayHours = 24) {
    const admin = { from: jest.fn(), rpc: jest.fn().mockResolvedValueOnce({ data: { shift: { ...shift, ...patch }, dayHours }, error: null })
        .mockResolvedValue({ data: { ok: true, shift: { ...shift, ledger_revision: 8, hours_worked: 8 } }, error: null }) };
    const run = (hoursWorked = 8, expectedRevision = 7, actorId = 'owner') => updateDashboardShiftHours({ admin, bizId: 'biz', shiftId: 'shift', actorId, hoursWorked, expectedRevision });
    return { admin, run };
}
describe('versioned closed shift hours command', () => {
    test('uses saved conditions, conserved rounding and one atomic command', async () => {
        const { admin, run } = setup();
        expect(await run()).toMatchObject({ ok: true, data: { shift: { ledger_revision: 8, hours_worked: 8 } } });
        expect(admin.rpc).toHaveBeenNthCalledWith(1, 'read_staff_shift_adjustment_snapshot', { p_shift_id: 'shift', p_biz_id: 'biz', p_actor_id: 'owner' });
        expect(admin.rpc).toHaveBeenNthCalledWith(2, 'adjust_closed_shift_hours_command', expect.objectContaining({
            p_actor_id: 'owner', p_expected_revision: 7, p_hours_worked: 8,
            p_calculation: expect.objectContaining({ totalAmount: 1001, totalConsumables: 99, baseMasterShare: 601, baseSalonShare: 499,
                guaranteedAmount: 800, topupAmount: 199, finalMasterShare: 800, finalSalonShare: 300 }),
        }));
        expect(admin.from).not.toHaveBeenCalled();
    });
    test('preserves the prior 10000/1000 ledger guarantee calculation', async () => {
        const { admin, run } = setup({ total_amount: 10000, consumables_amount: 1000, hourly_rate: 500 });
        expect(await run()).toMatchObject({ ok: true });
        expect(admin.rpc.mock.calls[1][1].p_calculation).toMatchObject({ guaranteedAmount: 4000, finalMasterShare: 6000, finalSalonShare: 5000, topupAmount: 0 });
    });
    test('null saved hourly rate does not reprice historical shift from current staff', async () => {
        const { admin, run } = setup({ hourly_rate: null, staff: { hourly_rate: 1000 } }); await run();
        expect(admin.rpc.mock.calls[1][1].p_calculation).toMatchObject({ guaranteedAmount: 0, finalMasterShare: 601, finalSalonShare: 499 });
    });
    test.each([{ status: 'open' }, { ledger_revision: 8 }])('rejects changed or reopened snapshot without commit %j', async patch => {
        const { admin, run } = setup(patch); expect(await run()).toMatchObject({ ok: false, status: 409 }); expect(admin.rpc).toHaveBeenCalledTimes(1);
    });
    test.each([[23, 24, 400], [24, 25, 400], [25, 25, 200], [23, 23, 200], [24, -1, 400], [24, NaN, 400]])('local day %s / input %s -> %s', async (day, hours, status) => {
        const { admin, run } = setup({}, day); const result = await run(hours);
        expect(result.ok ? 200 : result.status).toBe(status); expect(admin.rpc).toHaveBeenCalledTimes(status === 200 ? 2 : 1);
    });
    test.each([['42501',403],['P0002',404],['40001',409],['23514',400],['22023',400],['XX000',500]])('read failure %s is non-success %s', async (code,status) => {
        const { admin, run } = setup(); admin.rpc.mockReset().mockResolvedValue({ data: null, error: { code } });
        expect(await run()).toMatchObject({ ok: false, status }); expect(admin.rpc).toHaveBeenCalledTimes(1); expect(admin.from).not.toHaveBeenCalled();
    });
    test('concurrent commit conflict does not re-read/rebase/retry', async () => {
        const { admin, run } = setup(); admin.rpc.mockResolvedValue({ data: null, error: { code: '40001' } });
        expect(await run()).toMatchObject({ ok: false, status: 409 }); expect(admin.rpc).toHaveBeenCalledTimes(2); expect(admin.from).not.toHaveBeenCalled();
    });
    test.each([null, { ok:true, shift: { ...shift } }, { ok:true, shift: { ...shift, status:'open', ledger_revision:8 } }])('unconfirmed receipt %j is not success', async receipt => {
        const { admin, run } = setup(); admin.rpc.mockResolvedValue({ data: receipt, error: null }); expect(await run()).toMatchObject({ ok: false, status: 500 });
    });
    test.each([{ total_amount: NaN }, { hourly_rate: undefined }, { biz_id: 'foreign' }, { ledger_revision: undefined }])('malformed scoped snapshot %j is not calculated', async patch => {
        const { admin, run } = setup(patch); expect(await run()).toMatchObject({ ok: false, status: 500 }); expect(admin.rpc).toHaveBeenCalledTimes(1);
    });
    test('requires verified actor and original revision', async () => {
        const { admin, run } = setup(); expect(await run(8,7,'')).toMatchObject({ ok:false,status:403 });
        expect(await run(8,-1)).toMatchObject({ ok:false,status:409 }); expect(admin.rpc).not.toHaveBeenCalled();
    });
});
