import { runSaveStaffShiftItems } from '@/lib/staffShiftItemsService';
import { getServiceClient } from '@/lib/supabaseService';
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const draft = { clientId: 'ade307ae-6c38-424b-a9ee-63a32316c702', clientName: 'Synthetic client', serviceName: 'Cut', serviceAmount: 251, consumablesAmount: 49 };
const client = () => ({ rpc: jest.fn().mockResolvedValue({ data: { ok: true, shift_id: 'shift-test', revision: 9, items: [draft] }, error: null }), from: jest.fn() });
const save = (db: ReturnType<typeof client>, overrides: Record<string, unknown> = {}) => runSaveStaffShiftItems({
    supabase: db, staffId: 'staff-test', bizId: 'biz-test', actorId: 'actor-test', expectedShiftId: 'shift-test', expectedRevision: 8, items: [draft],
    targetShiftDate: '2026-10-12', isOwnerMode: false, useServiceClient: false, ...overrides,
});
beforeEach(() => jest.clearAllMocks());

test('passes stable item identities and all writes through one checked transaction', async () => {
    const db = client();
    expect(await save(db, { expectedRevision: 8 })).toEqual({ ok: true, data: { shiftId: 'shift-test', revision: 9, items: [draft] } });
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith('save_staff_shift_command', {
        p_staff_id: 'staff-test', p_biz_id: 'biz-test', p_actor_id: 'actor-test', p_shift_date: '2026-10-12',
        p_items: [draft], p_allow_create: false, p_expected_revision: 8, p_expected_shift_id: 'shift-test',
    });
    expect(db.from).not.toHaveBeenCalled();
});
test('does not collapse deliberate duplicate rows with distinct identities', async () => {
    const db = client();
    const items = [draft, { ...draft, clientId: '86e044d6-d065-4875-9946-a3789d1266f3' }];
    await save(db, { items });
    expect(db.rpc.mock.calls[0][1].p_items).toEqual(items);
});
test.each([['42501', 403], ['40001', 409], ['22023', 400], ['22P02', 400], ['23514', 400], ['P0001', 500]])(
    'surfaces database rejection %s without fallback writes', async (code, statusCode) => {
        const db = client(); db.rpc.mockResolvedValue({ data: null, error: { code } });
        expect(await save(db)).toMatchObject({ ok: false, statusCode });
        expect(db.rpc).toHaveBeenCalledTimes(1); expect(db.from).not.toHaveBeenCalled();
    },
);
test('missing actor cannot issue a privileged write', async () => {
    const db = client(); expect(await save(db, { actorId: '' })).toMatchObject({ ok: false, statusCode: 403 });
    expect(db.rpc).not.toHaveBeenCalled();
});
test('unconfirmed result is an error, never false success', async () => {
    const db = client(); db.rpc.mockResolvedValue({ data: { ok: false }, error: null });
    expect(await save(db)).toMatchObject({ ok: false, statusCode: 500 });
});
test('manager command carries the real actor to the service-role transaction', async () => {
    const db = client(), admin = client(); jest.mocked(getServiceClient).mockReturnValue(admin as never);
    expect(await save(db, { useServiceClient: true, isOwnerMode: true })).toEqual({ ok: true, data: { shiftId: 'shift-test', revision: 9, items: [draft] } });
    expect(admin.rpc).toHaveBeenCalledWith('save_staff_shift_command', expect.objectContaining({ p_actor_id: 'actor-test', p_allow_create: true }));
    expect(db.rpc).not.toHaveBeenCalled();
});
