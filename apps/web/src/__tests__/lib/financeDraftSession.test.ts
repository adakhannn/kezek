import { FinanceDraftSession, FinanceWriteError, type FinanceTransport } from '@/app/staff/finance/services/financeDraftSession';
import type { Shift, ShiftItem } from '@/app/staff/finance/types';

const shift = (revision = 7): Shift => ({ id: '11111111-1111-4111-8111-111111111111', ledger_revision: revision,
    shift_date: '2026-11-10', status: 'open', opened_at: '2026-11-10T03:00:00Z', closed_at: null, expected_start: null,
    late_minutes: 0, total_amount: 100, consumables_amount: 0, master_share: 60, salon_share: 40, percent_master: 60, percent_salon: 40 });
const row: ShiftItem = { id: '22222222-2222-4222-8222-222222222222', clientName: 'Before', serviceName: 'Service', serviceAmount: 100, consumablesAmount: 0 };
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function setup() {
    const transport: jest.Mocked<FinanceTransport> = {
        load: jest.fn().mockResolvedValue({ shift: shift(99), items: [{ ...row, clientName: 'Server' }] }),
        open: jest.fn().mockResolvedValue(undefined),
        save: jest.fn().mockImplementation(async (items, version) => ({ shiftId: shift().id, revision: version.expectedRevision + 2, items })),
        close: jest.fn().mockImplementation(async (_items, version) => ({ ...shift(version.expectedRevision + 1), status: 'closed' })),
    };
    const session = new FinanceDraftSession(transport);
    session.receive({ shift: shift(), items: [row] });
    return { session, transport };
}
test('a background read does not rebase or erase a dirty draft; a new revision blocks its write', async () => {
    const { session, transport } = setup();
    session.setItems([{ ...row, clientName: 'My edit' }]);
    session.receive({ shift: shift(), items: [row] });
    expect(session.getSnapshot().items[0].clientName).toBe('My edit');
    session.receive({ shift: shift(9), items: [{ ...row, clientName: 'Other tab' }] });
    expect(session.getSnapshot()).toMatchObject({ blocked: 'conflict', shift: { ledger_revision: 7 } });
    await expect(session.save()).rejects.toThrow();
    expect(transport.save).not.toHaveBeenCalled();
    expect(session.getSnapshot().items[0].clientName).toBe('My edit');
});
test('two simultaneous Save actions serialize and coalesce an unchanged draft', async () => {
    const { session, transport } = setup();
    session.setItems([{ ...row, serviceAmount: 200 }]);
    await Promise.all([session.save(), session.save(), session.save()]);
    expect(transport.save).toHaveBeenCalledTimes(1);
    expect(transport.save.mock.calls[0][1]).toEqual({ expectedShiftId: shift().id, expectedRevision: 7, calendarDate: '2026-11-10' });
    expect(session.getSnapshot().shift?.ledger_revision).toBe(9);
    expect(session.dirty).toBe(false);
});
test('queued save uses acknowledged revision, preserving edits made while a discounted item was saving', async () => {
    const { session, transport } = setup();
    const response = deferred<{ shiftId: string; revision: number; items: ShiftItem[] }>();
    transport.save.mockImplementationOnce(() => response.promise);
    session.setItems([{ ...row, serviceAmount: 200 }]);
    const first = session.save(); await Promise.resolve();
    session.setItems([{ ...row, serviceAmount: 200, clientName: 'Typed during request' }]);
    const second = session.save();
    response.resolve({ shiftId: shift().id, revision: 12, items: [{ ...row, serviceAmount: 90 }] });
    await Promise.all([first, second]);
    expect(transport.save.mock.calls[1]).toEqual([
        [expect.objectContaining({ serviceAmount: 90, clientName: 'Typed during request' })],
        { expectedShiftId: shift().id, expectedRevision: 12, calendarDate: '2026-11-10' },
    ]);
    expect(session.dirty).toBe(false);
});
test('canonical item IDs replace temporary IDs without resurrecting an item deleted in flight', async () => {
    const { session, transport } = setup(); const pending = deferred<any>();
    transport.save.mockImplementationOnce(() => pending.promise);
    const draft = { ...row, id: undefined, clientId: row.id! };
    session.setItems([{ ...draft, clientName: 'New' }]);
    const first = session.save(); await Promise.resolve();
    session.setItems([]);
    pending.resolve({ shiftId: shift().id, revision: 10, items: [{ ...row, clientName: 'New' }] });
    await first;
    expect(session.getSnapshot().items).toEqual([]);
    await session.save();
    expect(transport.save.mock.calls[1]).toEqual([[], { expectedShiftId: shift().id, expectedRevision: 10, calendarDate: '2026-11-10' }]);
});
test.each([new FinanceWriteError('Stale draft', 409), new TypeError('Network connection lost')])(
    'failed/uncertain writes retain the draft and block queued automatic retries: %s', async error => {
        const { session, transport } = setup();
        transport.save.mockRejectedValueOnce(error);
        session.setItems([{ ...row, serviceAmount: 777 }]);
        await Promise.allSettled([session.save(), session.save(), session.close()]);
        expect(transport.save).toHaveBeenCalledTimes(1);
        expect(transport.close).not.toHaveBeenCalled();
        expect(session.getSnapshot().items[0].serviceAmount).toBe(777);
        expect(session.getSnapshot().shift?.ledger_revision).toBe(7);
        session.receive({ shift: shift(99), items: [row] });
        expect(session.getSnapshot().items[0].serviceAmount).toBe(777);
    },
);
test('only explicit discard/reload can replace a conflicted draft and establish a new base', async () => {
    const { session, transport } = setup();
    session.setItems([{ ...row, serviceAmount: 777 }]);
    session.receive({ shift: shift(10), items: [row] });
    await session.reload();
    expect(session.getSnapshot()).toMatchObject({ blocked: null, shift: { ledger_revision: 99 }, items: [{ clientName: 'Server' }] });
    session.setItems([{ ...row, serviceAmount: 888 }]);
    await session.save();
    expect(transport.save.mock.calls[0][1].expectedRevision).toBe(99);
});
test('Close waits for Save, submits canonical ledger with its receipt revision, and repeated Close is harmless', async () => {
    const { session, transport } = setup(); const pending = deferred<any>();
    transport.save.mockImplementationOnce(() => pending.promise);
    session.setItems([{ ...row, serviceAmount: 200 }]);
    const saving = session.save(); const closing = session.close(); await Promise.resolve();
    expect(transport.close).not.toHaveBeenCalled();
    pending.resolve({ shiftId: shift().id, revision: 13, items: [{ ...row, serviceAmount: 90 }] });
    await Promise.all([saving, closing]);
    expect(transport.close).toHaveBeenCalledWith([{ ...row, serviceAmount: 90 }], { expectedShiftId: shift().id, expectedRevision: 13, calendarDate: '2026-11-10' });
    await session.close();
    expect(transport.close).toHaveBeenCalledTimes(1);
});
test('old in-flight reads cannot roll back an acknowledged revision', async () => {
    const { session } = setup(); session.setItems([{ ...row, serviceAmount: 200 }]); await session.save();
    session.receive({ shift: shift(), items: [row] });
    expect(session.getSnapshot().shift?.ledger_revision).toBe(9);
    expect(session.getSnapshot().items[0].serviceAmount).toBe(200);
});
test('Close does not finalize an earlier snapshot when the user edits during its prerequisite Save', async () => {
    const { session, transport } = setup(); const pending = deferred<any>();
    transport.save.mockImplementationOnce(() => pending.promise);
    session.setItems([{ ...row, serviceAmount: 200 }]);
    const closing = session.close(); await Promise.resolve();
    session.setItems([{ ...row, serviceAmount: 300 }]);
    pending.resolve({ shiftId: shift().id, revision: 8, items: [{ ...row, serviceAmount: 200 }] });
    await expect(closing).rejects.toThrow('Черновик изменён');
    expect(transport.close).not.toHaveBeenCalled();
    expect(session.getSnapshot()).toMatchObject({ blocked: null, shift: { status: 'open', ledger_revision: 8 }, items: [{ serviceAmount: 300 }] });
    await session.close();
    expect(transport.close).toHaveBeenCalledWith([{ ...row, serviceAmount: 300 }], { expectedShiftId: shift().id, expectedRevision: 10, calendarDate: '2026-11-10' });
});
test('an unversioned read cannot silently turn into an unconditional write', async () => {
    const { transport } = setup(); const session = new FinanceDraftSession(transport);
    session.receive({ shift: { ...shift(), ledger_revision: undefined } as unknown as Shift, items: [row] });
    await expect(session.save()).rejects.toThrow();
    expect(transport.save).not.toHaveBeenCalled();
});


test('midnight cannot rebase an absent-shift draft onto another calendar day', async () => {
    const { transport } = setup(); const session = new FinanceDraftSession(transport);
    session.receive({ shift: null, items: [], calendarDate: '2026-11-09' });
    session.setItems([{ ...row, id: undefined, clientId: row.id }]);
    session.receive({ shift: null, items: [], calendarDate: '2026-11-10' });
    expect(session.getSnapshot()).toMatchObject({ calendarDate: '2026-11-09', blocked: 'conflict', items: [{ clientName: 'Before' }] });
    await expect(session.save()).rejects.toMatchObject({ status: 409 }); expect(transport.save).not.toHaveBeenCalled();
});
test('background tomorrow snapshot cannot relabel an existing dirty draft, reload reviews the captured day', async () => {
    const { transport, session } = setup(); session.setItems([{ ...row, clientName: 'Pending' }]);
    session.receive({ shift: null, items: [], calendarDate: '2026-11-11' });
    expect(session.getSnapshot()).toMatchObject({ calendarDate: '2026-11-10', blocked: 'conflict' });
    await session.reload(); expect(transport.load).toHaveBeenCalledWith('2026-11-10');
});
test('clean absent-shift draft follows an explicitly received server day', () => {
    const { transport } = setup(); const session = new FinanceDraftSession(transport);
    session.receive({ shift: null, items: [], calendarDate: '2026-11-09' });
    session.receive({ shift: null, items: [], calendarDate: '2026-11-10' });
    expect(session.getSnapshot()).toMatchObject({ calendarDate: '2026-11-10', blocked: null });
});
