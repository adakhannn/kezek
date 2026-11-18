/** @jest-environment jsdom */
import { render, renderHook, screen, waitFor, act } from '@testing-library/react';

import Client from '@/app/dashboard/staff/[id]/schedule/Client';
import { useStaffScheduleRules } from '@/app/dashboard/staff/[id]/schedule/useStaffScheduleRules';
import { branchDayIntervals, legacyScheduleWriteMessage, nextYmd, weekdayOf } from '@/lib/scheduling/legacyDefaults';
import { supabase } from '@/lib/supabaseClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback: string) => fallback }) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { from: jest.fn() } }));

type Result = { data?: unknown; error: { code?: string; message: string } | null; count?: number };
type Call = { table: string; op: string; args: unknown[] };

const t = (_key: string, fallback: string) => fallback;
const HOME = 'branch-home';
const OTHER = 'branch-other';
// Wednesday 18 Nov 2026, 12:00 in Bishkek; the editor shows 16-29 Nov, 16 and 17 are past.
const NOW = new Date('2026-11-18T06:00:00Z');
// Mon-Fri 10:00-19:00; Saturday stored as [] (new format), Sunday absent (old format): both closed.
const BRANCH_HOURS = [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, intervals: [{ start: '10:00', end: '19:00' }] }))
    .concat([{ day_of_week: 6, intervals: [] }]);

let calls: Call[] = [];
let results: Record<string, Result> = {};

function builder(table: string) {
    let op = 'select';
    const self: Record<string, unknown> = {};
    for (const method of ['eq', 'neq', 'gte', 'lte', 'lt', 'in', 'order']) self[method] = () => self;
    self.select = (...args: unknown[]) => {
        if (op === 'select') calls.push({ table, op, args });
        return self;
    };
    for (const write of ['insert', 'update', 'upsert', 'delete']) {
        self[write] = (...args: unknown[]) => {
            op = write;
            calls.push({ table, op, args });
            return self;
        };
    }
    self.single = () => Promise.resolve(results[`${table}.${op}`] ?? { data: { id: 'saved' }, error: null });
    self.then = (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(results[`${table}.${op}`] ?? { data: null, error: null }).then(resolve, reject);
    return self;
}

const writes = () => calls.filter((call) => call.op !== 'select');

beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance', 'hrtime'] });
    jest.clearAllMocks();
    calls = [];
    results = {
        'staff_schedule_rules.select': {
            data: [
                { id: 'r17', date_on: '2026-11-17', intervals: [{ start: '09:00', end: '18:00' }], branch_id: HOME },
                { id: 'r19', date_on: '2026-11-19', intervals: [{ start: '09:00', end: '12:00' }], branch_id: HOME },
                { id: 'r19-old', date_on: '2026-11-19', intervals: [{ start: '08:00', end: '09:00' }], branch_id: HOME },
                { id: 'r20', date_on: '2026-11-20', intervals: [{ start: '11:00', end: '15:00' }], branch_id: OTHER },
            ],
            error: null,
        },
    };
    (supabase.from as jest.Mock).mockImplementation(builder);
});

afterEach(() => jest.useRealTimers());

function renderEditor(overrides: Partial<Parameters<typeof useStaffScheduleRules>[0]> = {}) {
    const showError = jest.fn();
    const showSuccess = jest.fn();
    const hook = renderHook(() => useStaffScheduleRules({
        bizId: 'biz-1', staffId: 'staff-1', homeBranchId: HOME, branchHours: BRANCH_HOURS, t, showError, showSuccess, ...overrides,
    }));
    return { ...hook, showError, showSuccess };
}

describe('legacy schedule rules (FE-02)', () => {
    test('branch hours of a date: unknown, open, closed in both storage formats', () => {
        expect(weekdayOf('2026-11-16')).toBe(1);
        expect(nextYmd('2026-11-30')).toBe('2026-12-01');
        expect(branchDayIntervals([], '2026-11-16')).toBeUndefined();
        expect(branchDayIntervals(BRANCH_HOURS, '2026-11-16')).toEqual([{ start: '10:00', end: '19:00' }]);
        expect(branchDayIntervals(BRANCH_HOURS, '2026-11-21')).toEqual([]);
        expect(branchDayIntervals(BRANCH_HOURS, '2026-11-22')).toEqual([]);
    });

    test('database refusals become readable messages', () => {
        expect(legacyScheduleWriteMessage({ message: 'SCHEDULE_USE_PUBLICATION_EDITOR' }, t)).toMatch(/новой модели/);
        expect(legacyScheduleWriteMessage({ code: '42501', message: 'new row violates row-level security policy' }, t)).toMatch(/прав/);
        expect(legacyScheduleWriteMessage({ code: '23505', message: 'duplicate key' }, t)).toMatch(/другой пользователь/);
        expect(legacyScheduleWriteMessage({ code: 'PGRST116', message: '0 rows' }, t)).toMatch(/не применено/);
        expect(legacyScheduleWriteMessage(new Error('boom'), t)).toBe('Ошибка при сохранении расписания');
    });

    test('opening the editor only reads: no rule is created, the newest rule of a date wins', async () => {
        const { result } = renderEditor();

        await waitFor(() => expect(result.current.status).toBe('ready'));

        expect(writes()).toEqual([]);
        expect(result.current.rulesByDate.get('2026-11-19')).toMatchObject({ id: 'r19' });
        expect(result.current.rulesByDate.has('2026-11-18')).toBe(false);
    });

    test('a failed read is an error, not an empty schedule', async () => {
        results['staff_schedule_rules.select'] = { data: null, error: { message: 'timeout' } };
        const { result } = renderEditor();

        await waitFor(() => expect(result.current.status).toBe('error'));

        expect(writes()).toEqual([]);
        expect(result.current.rulesByDate.size).toBe(0);
    });

    test('branch hours fill days from today in one statement: closed days off, transfers and past days kept', async () => {
        const { result, showSuccess } = renderEditor();
        await waitFor(() => expect(result.current.status).toBe('ready'));

        const plan = result.current.planBranchSchedule();
        expect(plan).toEqual({ dates: expect.any(Array), overwrite: 1, keptTransfers: 1 });
        expect(plan?.dates[0]).toBe('2026-11-18');
        expect(plan?.dates).not.toContain('2026-11-20');
        expect(plan?.dates).toHaveLength(11);

        results['staff_schedule_rules.upsert'] = { data: plan!.dates.map((date) => ({ id: date })), error: null };
        await act(async () => { await result.current.applyBranchSchedule(plan!); });

        const upserts = writes();
        expect(upserts).toHaveLength(1);
        expect(upserts[0]).toMatchObject({ table: 'staff_schedule_rules', op: 'upsert' });
        const rows = upserts[0].args[0] as Array<{ id?: string; date_on: string; intervals: unknown[]; branch_id: string }>;
        const byDate = new Map(rows.map((row) => [row.date_on, row]));
        expect(byDate.get('2026-11-19')).toMatchObject({ id: 'r19', intervals: [{ start: '10:00', end: '19:00' }], branch_id: HOME });
        expect(byDate.get('2026-11-21')?.intervals).toEqual([]);
        expect(byDate.get('2026-11-22')?.intervals).toEqual([]);
        expect(byDate.get('2026-11-23')).not.toHaveProperty('id');
        expect(byDate.has('2026-11-17')).toBe(false);
        expect(upserts[0].args[1]).toEqual({ onConflict: 'id', defaultToNull: false });
        expect(showSuccess).toHaveBeenCalled();
    });

    test('without branch hours nothing is invented', async () => {
        const missing = renderEditor({ branchHours: [] });
        await waitFor(() => expect(missing.result.current.status).toBe('ready'));
        expect(missing.result.current.planBranchSchedule()).toBeNull();
        expect(missing.showError).toHaveBeenCalledWith(expect.stringMatching(/не настроены/));

        const unreadable = renderEditor({ branchHours: null });
        await waitFor(() => expect(unreadable.result.current.status).toBe('ready'));
        expect(unreadable.result.current.planBranchSchedule()).toBeNull();
        expect(unreadable.showError).toHaveBeenCalledWith(expect.stringMatching(/Не удалось загрузить/));
        expect(writes()).toEqual([]);
    });

    test('a refused save is reported and the staff_branch_assignments writes are gone', async () => {
        const { result, showError, showSuccess } = renderEditor();
        await waitFor(() => expect(result.current.status).toBe('ready'));

        results['staff_schedule_rules.update'] = { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
        await act(async () => { await result.current.saveDay('2026-11-19', { start: '10:00', end: '14:00' }, OTHER); });
        expect(showError).toHaveBeenLastCalledWith(expect.stringMatching(/не применено/));

        results['staff_schedule_rules.insert'] = { data: null, error: { code: 'P0001', message: 'SCHEDULE_USE_PUBLICATION_EDITOR' } };
        await act(async () => { await result.current.saveDay('2026-11-24', null, HOME); });
        expect(showError).toHaveBeenLastCalledWith(expect.stringMatching(/новой модели/));

        expect(showSuccess).not.toHaveBeenCalled();
        expect(calls.some((call) => call.table === 'staff_branch_assignments')).toBe(false);
    });

    test('past days and transfer days with bookings are not changed', async () => {
        const { result, showError } = renderEditor();
        await waitFor(() => expect(result.current.status).toBe('ready'));

        await act(async () => { await result.current.saveDay('2026-11-17', null, HOME); });
        expect(showError).toHaveBeenLastCalledWith('Прошедшие дни не меняются');

        results['bookings.select'] = { count: 2, error: null };
        await act(async () => { await result.current.saveDay('2026-11-20', { start: '10:00', end: '14:00' }, HOME); });
        expect(showError).toHaveBeenLastCalledWith(expect.stringMatching(/записи в филиале перевода/));
        expect(writes()).toEqual([]);
    });

    test('a saved day reloads the schedule and confirms', async () => {
        const { result, showSuccess } = renderEditor();
        await waitFor(() => expect(result.current.status).toBe('ready'));

        await act(async () => { await result.current.saveDay('2026-11-25', { start: '10:00', end: '14:00' }, HOME); });

        expect(writes()).toEqual([expect.objectContaining({ table: 'staff_schedule_rules', op: 'insert' })]);
        expect(showSuccess).toHaveBeenCalledWith('Сохранено');
    });

    test('staff on published schedules see a notice and the page does not touch legacy rules', () => {
        render(<Client bizId="biz-1" staffId="staff-1" branches={[{ id: HOME, name: 'Home' }]} homeBranchId={HOME} branchHours={BRANCH_HOURS} usesPublishedSchedule />);

        expect(screen.getByText('График сотрудника ведётся в новой модели расписаний')).toBeTruthy();
        expect(supabase.from).not.toHaveBeenCalled();
    });
});
