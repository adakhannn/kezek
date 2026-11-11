import type { Shift, ShiftItem } from '../types';
import { serializeShiftItems } from '../utils/itemLogic';

export type FinanceVersion = { expectedShiftId: string | null; expectedRevision: number | null; calendarDate?: string };
export type FinanceLedgerSnapshot = { shift: Shift | null; items: ShiftItem[]; calendarDate?: string };
export type FinanceSaveReceipt = { shiftId: string; revision: number; items: ShiftItem[] };
export type FinanceTransport = {
    load: (date?: string) => Promise<FinanceLedgerSnapshot>;
    open: (date?: string) => Promise<unknown>;
    save: (items: ShiftItem[], version: FinanceVersion) => Promise<FinanceSaveReceipt>;
    close: (items: ShiftItem[], version: FinanceVersion) => Promise<Shift>;
};
export class FinanceWriteError extends Error {
    constructor(message: string, public readonly status = 0) { super(message); }
}
type DraftState = FinanceLedgerSnapshot & {
    savedItems: ShiftItem[];
    initialized: boolean;
    blocked: 'conflict' | 'uncertain' | null;
    operation: 'save' | 'close' | 'open' | 'reload' | null;
    error: string | null;
};
const identity = (item: ShiftItem) => item.id ?? item.clientId;
const fields = ['clientName', 'serviceName', 'serviceAmount', 'consumablesAmount', 'bookingId'] as const;

/** Apply acknowledged IDs/discounts only to fields the user has not edited since submission. */
export function acknowledgeFinanceItems(current: ShiftItem[], submitted: ShiftItem[], persisted: ShiftItem[]): ShiftItem[] {
    const sent = new Map(submitted.map(item => [identity(item), item]));
    const saved = new Map(persisted.map(item => [identity(item), item]));
    return current.map(item => {
        const before = sent.get(identity(item));
        const after = saved.get(identity(item));
        if (!before || !after) return item;
        const merged = { ...item, id: after.id, createdAt: after.createdAt };
        for (const field of fields) {
            if (item[field] === before[field]) Object.assign(merged, { [field]: after[field] });
        }
        return merged;
    });
}

/** One instance owns one staff/date draft. Query cache updates cannot rebase a dirty draft. */
export class FinanceDraftSession {
    private state: DraftState = { shift: null, items: [], savedItems: [], initialized: false,
        blocked: null, operation: null, error: null };
    private listeners = new Set<() => void>();
    private tail: Promise<unknown> = Promise.resolve();
    constructor(private readonly transport: FinanceTransport,
        private prepare: (items: ShiftItem[]) => ShiftItem[] = items => items) {}
    setPrepare(prepare: (items: ShiftItem[]) => ShiftItem[]) { this.prepare = prepare; }
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private update(patch: Partial<DraftState>) {
        this.state = { ...this.state, ...patch };
        this.listeners.forEach(listener => listener());
    }
    get dirty() { return serializeShiftItems(this.prepare(this.state.items)) !== serializeShiftItems(this.state.savedItems); }
    private version(): FinanceVersion {
        return { expectedShiftId: this.state.shift?.id ?? null, expectedRevision: this.state.shift?.ledger_revision ?? null, calendarDate: this.state.calendarDate ?? this.state.shift?.shift_date };
    }
    private accept(snapshot: FinanceLedgerSnapshot) {
        if (snapshot.shift && !Number.isSafeInteger(snapshot.shift.ledger_revision)) {
            this.update({ blocked: 'uncertain', error: 'Не удалось получить версию смены. Обновите данные перед записью.' });
            return;
        }
        this.update({ ...snapshot, calendarDate: snapshot.calendarDate ?? snapshot.shift?.shift_date, savedItems: snapshot.items, initialized: true, blocked: null, error: null });
    }
    receive = (snapshot: FinanceLedgerSnapshot) => {
        if (this.state.operation || this.state.blocked) return;
        if (!this.state.initialized) { this.accept(snapshot); return; }
        const current = this.version();
        const sameShift = snapshot.shift?.id === this.state.shift?.id;
        const incomingRevision = snapshot.shift?.ledger_revision ?? null;
        // A read begun before a committed Save must not restore its older snapshot.
        if (sameShift && incomingRevision !== null && current.expectedRevision !== null && incomingRevision < current.expectedRevision) return;
        const changed = !sameShift || incomingRevision !== current.expectedRevision || (snapshot.calendarDate ?? snapshot.shift?.shift_date) !== this.state.calendarDate;
        if (this.dirty) {
            if (changed) this.update({ blocked: 'conflict', error: 'Смена изменена в другом окне. Ваш черновик сохранён на экране.' });
            return;
        }
        this.accept(snapshot);
    };
    setItems = (next: ShiftItem[] | ((items: ShiftItem[]) => ShiftItem[])) => {
        this.update({ items: typeof next === 'function' ? next(this.state.items) : next });
    };
    private assertWritable() {
        if (!this.state.initialized || this.state.blocked || (!this.state.shift && !this.state.calendarDate)) throw new FinanceWriteError(
            this.state.error ?? 'Сначала загрузите актуальную смену.', 409);
        if (this.state.shift?.status === 'closed') throw new FinanceWriteError('Смена уже закрыта.', 409);
    }
    private fail(error: unknown) {
        const status = error instanceof FinanceWriteError ? error.status : 0;
        this.update({ blocked: status === 409 ? 'conflict' : status === 0 || status >= 500 ? 'uncertain' : this.state.blocked,
            error: error instanceof Error ? error.message : 'Не удалось подтвердить сохранение. Черновик оставлен на экране.' });
    }
    private enqueue<T>(action: () => Promise<T>): Promise<T> {
        const operation = this.tail.then(action).catch(error => { this.fail(error); throw error; });
        this.tail = operation.catch(() => undefined);
        return operation;
    }
    private async saveCurrent() {
        if (this.state.shift?.status === 'closed' && !this.dirty && !this.state.blocked) return;
        this.assertWritable();
        const submitted = this.prepare(this.state.items);
        if (serializeShiftItems(submitted) === serializeShiftItems(this.state.savedItems)) return;
        this.update({ operation: 'save', error: null });
        try {
            const receipt = await this.transport.save(submitted, this.version());
            if (!receipt || !Number.isSafeInteger(receipt.revision) || !receipt.shiftId || !Array.isArray(receipt.items)) {
                throw new FinanceWriteError('Сохранение не подтверждено. Загрузите смену перед следующей записью.');
            }
            // An owner can create an absent shift with Save; load its full header before Close.
            if (!this.state.shift) {
                const loaded = await this.transport.load(this.state.calendarDate);
                if (loaded.shift?.id !== receipt.shiftId || loaded.shift.ledger_revision !== receipt.revision) {
                    throw new FinanceWriteError('Смена изменилась после сохранения. Проверьте актуальные данные.', 409);
                }
                this.update({ shift: loaded.shift });
            }
            const items = serializeShiftItems(this.state.items) === serializeShiftItems(submitted)
                ? receipt.items : acknowledgeFinanceItems(this.state.items, submitted, receipt.items);
            this.update({ shift: { ...this.state.shift!, id: receipt.shiftId, ledger_revision: receipt.revision },
                items, savedItems: receipt.items });
        } catch (error) { this.fail(error); throw error; }
        finally { this.update({ operation: null }); }
    }
    save = () => this.enqueue(() => this.saveCurrent());
    close = () => this.enqueue(async () => {
        if (this.state.shift?.status === 'closed' && !this.dirty && !this.state.blocked) return;
        await this.saveCurrent();
        this.assertWritable();
        if (this.dirty) throw new FinanceWriteError('Черновик изменён во время сохранения. Проверьте новые правки перед закрытием смены.', 400);
        if (!this.state.shift) throw new FinanceWriteError('Смена ещё не открыта.', 400);
        this.update({ operation: 'close', error: null });
        try {
            const shift = await this.transport.close(this.state.savedItems, this.version());
            if (!shift || !Number.isSafeInteger(shift.ledger_revision)) throw new FinanceWriteError('Не удалось подтвердить закрытие смены.');
            this.update({ shift });
        } catch (error) { this.fail(error); throw error; }
        finally { this.update({ operation: null }); }
    });
    open = () => this.enqueue(async () => {
        if (!this.state.initialized || !this.state.calendarDate || this.state.blocked || this.dirty) throw new FinanceWriteError('Сначала сохраните или сверьте черновик.', 409);
        this.update({ operation: 'open', error: null });
        try { await this.transport.open(this.state.calendarDate); this.accept(await this.transport.load(this.state.calendarDate)); }
        catch (error) { this.fail(error); throw error; }
        finally { this.update({ operation: null }); }
    });
    /** Explicit user choice: discard this draft and read a new coherent server snapshot. */
    reload = () => this.enqueue(async () => {
        this.update({ operation: 'reload' });
        try { this.accept(await this.transport.load(this.state.calendarDate)); }
        catch (error) { this.fail(error); throw error; }
        finally { this.update({ operation: null }); }
    });
}
