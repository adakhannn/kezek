import { createTranslate } from '../../../i18n/translate';
import { isReadableServerMessage, staffErrorMessage } from '../../../screens/manageStaff/errors';
import {
    emptyWeek,
    validPublishSchedule,
    validScheduleDay,
    validTimeOff,
    weekFromBranchHours,
} from '../../../screens/manageStaff/explicitSchedule';
import {
    formatShare,
    guaranteeLine,
    parseShiftHours,
    shiftCalculations,
    shiftEmployeeAmount,
    shiftItemFromDraft,
    shiftStatsDate,
    statsDateParam,
    statsSummary,
    wireShiftItems,
} from '../../../screens/manageStaff/financeView';
import {
    branchDayIntervals,
    branchScheduleRows,
    dayDraft,
    legacyScheduleWriteMessageKey,
    planBranchSchedule,
    winningRules,
    withEnd,
    withStart,
} from '../../../screens/manageStaff/legacySchedule';
import { nextAutoClientName } from '../../../screens/manageStaff/ManageStaffFinanceScreen';
import { canSubmitSlotClient, internalBookingInput, slotClientPayload, uniqueSlots } from '../../../screens/manageStaff/slots';
import {
    filterStaffRows,
    pageOf,
    staffCounts,
    staffFormFromCard,
    staffInitials,
    validateStaffForm,
    withMasterPercent,
    withSalonPercent,
} from '../../../screens/manageStaff/staffForm';
import type { StaffFinanceStatsPayload, StaffFinanceStatsShift, StaffRow } from '../../../screens/manageStaff/types';

jest.mock('../../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../../lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), auth: { getSession: jest.fn() } } }));

const STAFF = {
    id: 'staff-1', full_name: 'Азамат Касымов', email: null, phone: '+996555123456', branch_id: 'branch-1',
    is_active: true, percent_master: 60, percent_salon: 40, hourly_rate: null,
};

describe('staff form (StaffForm of /dashboard/staff/[id])', () => {
    test('a valid card posts the website body: empty contacts as null, shares as numbers', () => {
        const result = validateStaffForm(staffFormFromCard(STAFF));
        expect(result).toEqual({ ok: true, body: {
            id: 'staff-1', full_name: 'Азамат Касымов', email: null, phone: '+996555123456', branch_id: 'branch-1',
            is_active: true, percent_master: 60, percent_salon: 40, hourly_rate: null,
        } });
    });

    test('typing one share sets the other to the rest of 100', () => {
        const form = staffFormFromCard(STAFF);
        expect(withMasterPercent(form, '70')).toMatchObject({ percent_master: '70', percent_salon: '30' });
        expect(withSalonPercent(form, '25')).toMatchObject({ percent_master: '75', percent_salon: '25' });
    });

    test('the checks run in the website order with its messages', () => {
        const form = staffFormFromCard(STAFF);
        expect(validateStaffForm({ ...form, full_name: ' ' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.nameRequired' });
        expect(validateStaffForm({ ...form, full_name: 'А' })).toEqual({ ok: false, error: 'manageStaff.form.nameLength' });
        expect(validateStaffForm({ ...form, email: 'not-mail' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.emailInvalid' });
        expect(validateStaffForm({ ...form, phone: '0555' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.phoneInvalid' });
        expect(validateStaffForm({ ...form, percent_master: '120', percent_salon: '-20' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.percentMasterInvalid' });
        expect(validateStaffForm({ ...form, percent_master: '50', percent_salon: '40' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.percentSumInvalid' });
        expect(validateStaffForm({ ...form, hourly_rate: '-5' })).toEqual({ ok: false, error: 'manageStaff.staff.form.errors.hourlyRateInvalid' });
    });

    test('an hourly rate of 0 clears it, like `Number(value) || null` on the website', () => {
        const form = staffFormFromCard(STAFF);
        expect(validateStaffForm({ ...form, hourly_rate: '0' })).toMatchObject({ ok: true, body: { hourly_rate: null } });
        expect(validateStaffForm({ ...form, hourly_rate: '150,5' })).toMatchObject({ ok: true, body: { hourly_rate: 150.5 } });
    });
});

describe('staff list', () => {
    const rows: StaffRow[] = [
        { id: '1', full_name: 'Азамат', is_active: true, branch_id: 'b', branches: { name: 'Центр' } },
        { id: '2', full_name: 'Бакыт Уулу', is_active: false, branch_id: 'b', branches: null },
        { id: '3', full_name: 'азиза', is_active: null, branch_id: 'b', branches: null },
    ];

    test('search by name ignores case; the status filter treats null as inactive', () => {
        expect(filterStaffRows(rows, 'АЗ', 'all').map((row) => row.id)).toEqual(['1', '3']);
        expect(filterStaffRows(rows, '', 'active').map((row) => row.id)).toEqual(['1']);
        expect(filterStaffRows(rows, '', 'inactive').map((row) => row.id)).toEqual(['2', '3']);
        expect(staffCounts(rows)).toEqual({ active: 1, inactive: 2, total: 3 });
    });

    test('initials and pages of 30', () => {
        expect(staffInitials('Бакыт Уулу')).toBe('БУ');
        expect(staffInitials('')).toBe('??');
        const page = pageOf(Array.from({ length: 65 }, (_, index) => index), 3);
        expect(page).toMatchObject({ page: 3, totalPages: 3, from: 61, to: 65 });
        expect(page.items).toEqual([60, 61, 62, 63, 64]);
    });
});

describe('legacy schedule (FE-02)', () => {
    const hours = [{ day_of_week: 1, intervals: [{ start: '10:00', end: '19:00' }] }];
    const week = ['2030-01-07', '2030-01-08', '2030-01-09'];

    test('branch hours: unknown, closed or open by weekday', () => {
        expect(branchDayIntervals([], '2030-01-07')).toBeUndefined();
        expect(branchDayIntervals(hours, '2030-01-07')).toEqual([{ start: '10:00', end: '19:00' }]);
        expect(branchDayIntervals(hours, '2030-01-08')).toEqual([]);
    });

    test('the first rule of a date wins; an empty branch is the home branch', () => {
        const rules = winningRules([
            { id: 'a', date_on: '2030-01-07', intervals: [{ start: '09:00', end: '18:00' }], branch_id: null },
            { id: 'b', date_on: '2030-01-07', intervals: [], branch_id: 'other' },
        ], 'home');
        expect(rules.get('2030-01-07')).toEqual({ id: 'a', intervals: [{ start: '09:00', end: '18:00' }], branch_id: 'home' });
    });

    test('apply branch hours: past days skipped, transfers kept, saved days overwritten, closed days become days off', () => {
        const rules = new Map([
            ['2030-01-08', { id: 'saved', intervals: [{ start: '09:00', end: '12:00' }], branch_id: 'home' }],
            ['2030-01-09', { id: 'transfer', intervals: [{ start: '09:00', end: '12:00' }], branch_id: 'other' }],
        ]);
        const result = planBranchSchedule(week, '2030-01-08', rules, 'home', hours);
        expect(result).toEqual({ ok: true, plan: { dates: ['2030-01-08'], overwrite: 1, keptTransfers: 1 } });
        if (!result.ok) throw new Error('plan');
        expect(branchScheduleRows(result.plan, { bizId: 'biz', staffId: 'staff', homeBranchId: 'home', tz: 'Asia/Bishkek' }, rules, hours)).toEqual([{
            id: 'saved', biz_id: 'biz', staff_id: 'staff', kind: 'date', date_on: '2030-01-08', branch_id: 'home',
            tz: 'Asia/Bishkek', intervals: [], breaks: [], is_active: true, priority: 0,
        }]);
    });

    test('apply is refused without branch hours, with the website texts', () => {
        expect(planBranchSchedule(week, '2030-01-07', new Map(), 'home', null)).toEqual({ ok: false, error: 'manageStaff.staff.schedule.branchHoursUnavailable' });
        expect(planBranchSchedule(week, '2030-01-07', new Map(), 'home', [])).toEqual({ ok: false, error: 'manageStaff.staff.schedule.branchHoursMissing' });
    });

    test('a day draft starts from the rule, else branch hours, a closed branch day is a day off', () => {
        expect(dayDraft(undefined, [], 'home')).toMatchObject({ unsaved: true, dayOff: true, branchId: 'home' });
        expect(dayDraft(undefined, [{ start: '10:00', end: '19:00' }], 'home')).toMatchObject({ dayOff: false, interval: { start: '10:00', end: '19:00' } });
        expect(dayDraft({ id: 'r', intervals: [], branch_id: 'other' }, undefined, 'home')).toMatchObject({ unsaved: false, dayOff: true, branchId: 'other' });
    });

    test('time edits keep start before end, as the website inputs do', () => {
        expect(withStart({ start: '09:00', end: '10:00' }, '11:00')).toEqual({ start: '11:00', end: '11:00' });
        expect(withStart({ start: '09:00', end: '18:00' }, '10:30')).toEqual({ start: '10:30', end: '18:00' });
        expect(withEnd({ start: '12:00', end: '18:00' }, '11:00')).toEqual({ start: '11:00', end: '11:00' });
        expect(withStart({ start: '09:00', end: '18:00' }, '9:5')).toEqual({ start: '09:00', end: '18:00' });
    });

    test('write errors map to the website messages', () => {
        expect(legacyScheduleWriteMessageKey({ message: 'SCHEDULE_USE_PUBLICATION_EDITOR' })).toBe('manageStaff.staff.schedule.useNewEditor');
        expect(legacyScheduleWriteMessageKey({ code: '42501' })).toBe('manageStaff.staff.schedule.noPermission');
        expect(legacyScheduleWriteMessageKey({ code: '23505' })).toBe('manageStaff.staff.schedule.staleConflict');
        expect(legacyScheduleWriteMessageKey({ code: 'PGRST116' })).toBe('manageStaff.staff.schedule.notApplied');
        expect(legacyScheduleWriteMessageKey(new Error('x'))).toBe('manageStaff.staff.schedule.saveError');
    });
});

describe('explicit schedule and absences (SCHEDULE_V2_ENABLED)', () => {
    const branchId = '11111111-1111-4111-8111-111111111111';

    test('a publication is checked like validatePublishSchedule', () => {
        const days = emptyWeek();
        days['1'] = { intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }] };
        expect(validPublishSchedule({ kind: 'week', from: '2030-01-07', branchId, expectedRevision: 3, days })).toBe(true);
        expect(validPublishSchedule({ kind: 'week', from: '2030-02-30', branchId, expectedRevision: 3, days })).toBe(false);
        expect(validPublishSchedule({ kind: 'day', from: '2030-01-07', branchId, expectedRevision: 3, days })).toBe(false);
        expect(validScheduleDay({ intervals: [{ start: '09:00', end: '12:00' }], breaks: [{ start: '12:30', end: '13:00' }] })).toBe(false);
        expect(validScheduleDay({ intervals: [{ start: '14:00', end: '18:00' }, { start: '09:00', end: '12:00' }], breaks: [] })).toBe(false);
    });

    test('branch hours fill the week with Sunday as day 7', () => {
        const week = weekFromBranchHours([{ day_of_week: 0, intervals: [{ start: '10:00', end: '16:00' }] }]);
        expect(week['7']).toEqual({ intervals: [{ start: '10:00', end: '16:00' }], breaks: [] });
        expect(week['1']).toEqual({ intervals: [], breaks: [] });
    });

    test('an absence starts today or later, ends on or after it, lasts at most a year', () => {
        expect(validTimeOff('2030-01-07', '2030-01-07', '2030-01-07')).toBe(true);
        expect(validTimeOff('2030-01-06', '2030-01-07', '2030-01-07')).toBe(false);
        expect(validTimeOff('2030-01-08', '2030-01-07', '2030-01-07')).toBe(false);
        expect(validTimeOff('2030-01-07', '2031-01-08', '2030-01-07')).toBe(false);
    });
});

describe('finance display (same ledger and domain as the website)', () => {
    const items = [
        { id: 'i1', clientName: 'A', serviceName: 'Стрижка', serviceAmount: 1000, consumablesAmount: 100, bookingId: null },
        { id: 'i2', clientName: 'B', serviceName: 'Бритьё', serviceAmount: 501, consumablesAmount: 0, bookingId: 'bk' },
    ];
    const shift = {
        id: 's', ledger_revision: 4, shift_date: '2030-01-07', opened_at: null, closed_at: null, status: 'closed' as const,
        total_amount: 1501, consumables_amount: 100, master_share: 900.6, salon_share: 700.4, percent_master: 60, percent_salon: 40,
        hours_worked: 8, hourly_rate: 100, guaranteed_amount: 800,
    };

    test('a closed shift shows the stored shares and total', () => {
        expect(shiftCalculations(items, shift, false, 60, 40, null)).toEqual({
            totalAmount: 1501, totalConsumables: 100, masterShare: 900.6, salonShare: 700.4, displayTotalAmount: 1501,
        });
    });

    test('an open shift splits live, the rounding remainder and materials go to the business, the guarantee tops up', () => {
        const open = { ...shift, status: 'open' as const };
        expect(shiftCalculations(items, open, true, 60, 40, null)).toMatchObject({ masterShare: 901, salonShare: 700 });
        expect(shiftCalculations(items, open, true, 60, 40, 1200)).toMatchObject({ masterShare: 1200, salonShare: 401 });
        expect(guaranteeLine(open, true, 100, 8, 1200)).toBe(1200);
        expect(guaranteeLine(shift, false, null, null, null)).toBe(800);
        expect(guaranteeLine({ ...shift, hourly_rate: null }, false, null, null, null)).toBeNull();
    });

    test('period summary uses the API totals; turnover includes materials', () => {
        const stats = {
            totalAmount: 10000, totalConsumables: 500, totalLateMinutes: 15, shifts: [
                { guaranteed_amount: 3000, master_share: 2500, base_master_share: 2500 },
                { guaranteed_amount: 0, master_share: 4000, topup_amount: 0 },
            ],
        } as unknown as StaffFinanceStatsPayload;
        expect(statsSummary(stats)).toEqual({
            turnover: 10500, topup: 500, guaranteeUsed: true,
            flags: { lateMinutes: 15, consumables: 500, guarantee: 500 },
        });
        expect(statsSummary({ ...stats, totalTopupAmount: 0 })).toMatchObject({ topup: 0, guaranteeUsed: false });
        expect(formatShare(2500, 10000)).toBe('25.0%');
        expect(formatShare(1, 0)).toBe('0%');
        expect(shiftEmployeeAmount({ guaranteed_amount: 3000, master_share: 2500 } as StaffFinanceStatsShift)).toBe(3000);
        expect(shiftEmployeeAmount({ guaranteed_amount: 0, master_share: 2500 } as StaffFinanceStatsShift)).toBe(2500);
    });

    test('stats dates per period and their steps', () => {
        expect(statsDateParam('day', '2030-03-15')).toBe('2030-03-15');
        expect(statsDateParam('month', '2030-03-15')).toBe('2030-03');
        expect(statsDateParam('year', '2030-03-15')).toBe('2030');
        expect(shiftStatsDate('day', '2030-03-01', -1)).toBe('2030-02-28');
        expect(shiftStatsDate('month', '2030-01-15', -1)).toBe('2029-12-01');
        expect(shiftStatsDate('year', '2030-03-15', 1)).toBe('2031-01-01');
    });

    test('hours correction is 0 to the day length', () => {
        expect(parseShiftHours('7,5', 12)).toEqual({ ok: true, hours: 7.5 });
        expect(parseShiftHours('13', 12)).toEqual({ ok: false });
        expect(parseShiftHours('', 12)).toEqual({ ok: false });
        expect(parseShiftHours('-1', 12)).toEqual({ ok: false });
    });

    test('client rows: amounts checked, walk-ins get the automatic name, service names deduplicated', () => {
        expect(shiftItemFromDraft({ clientName: '', serviceName: 'A + A + B', serviceAmount: '500', consumablesAmount: '', bookingId: null }, 'Клиент 2'))
            .toEqual({ ok: true, item: { clientName: 'Клиент 2', serviceName: 'A + B', serviceAmount: 500, consumablesAmount: 0, bookingId: null } });
        expect(shiftItemFromDraft({ clientName: '', serviceName: '', serviceAmount: '-1', consumablesAmount: '', bookingId: null }, 'Клиент 1'))
            .toEqual({ ok: false, error: 'amount' });
        expect(nextAutoClientName([{ clientName: 'Клиент 1', serviceName: '', serviceAmount: 0, consumablesAmount: 0 }], 'Клиент', null)).toBe('Клиент 2');
        expect(wireShiftItems([{ ...items[0], createdAt: '2030-01-07T10:00:00Z' }])).toEqual([
            { id: 'i1', clientName: 'A', serviceName: 'Стрижка', serviceAmount: 1000, consumablesAmount: 100, bookingId: null },
        ]);
    });
});

describe('booking from free slots (FE-12)', () => {
    const base = { mode: 'none' as const, selectedClientId: '', foundUsers: [], searchLoading: false, newClientName: '', newClientPhone: '' };

    test('walk-in, existing account and new client payloads', () => {
        expect(slotClientPayload(base)).toEqual({ ok: true, payload: { clientId: null, clientName: null, clientPhone: null } });
        const found = [{ id: 'u1', full_name: 'Айбек', email: null, phone: null }];
        expect(slotClientPayload({ ...base, mode: 'existing', foundUsers: found, selectedClientId: 'u2' }))
            .toEqual({ ok: false, error: 'manageStaff.bookings.desk.errors.selectClient' });
        expect(slotClientPayload({ ...base, mode: 'existing', foundUsers: found, selectedClientId: 'u1' }))
            .toEqual({ ok: true, payload: { clientId: 'u1', clientName: null, clientPhone: null } });
        expect(slotClientPayload({ ...base, mode: 'new', newClientName: 'Айбек', newClientPhone: '0555' }))
            .toEqual({ ok: false, error: 'manageStaff.bookings.desk.errors.phoneRequired' });
        expect(slotClientPayload({ ...base, mode: 'new', newClientName: ' Айбек ', newClientPhone: '+996555123456' }))
            .toEqual({ ok: true, payload: { clientId: null, clientName: 'Айбек', clientPhone: '+996555123456' } });
        expect(canSubmitSlotClient({ ...base, mode: 'new', newClientName: 'A' })).toBe(false);
    });

    test('the internal booking body and unique slot starts', () => {
        expect(internalBookingInput({
            bizId: 'b', branchId: 'br', staffId: 's', serviceId: 'sv', startAt: '2030-01-07T05:00:00Z', minutes: 30,
            client: { clientId: null, clientName: 'A', clientPhone: '+996555123456' },
        })).toEqual({
            mode: 'simple', biz_id: 'b', branch_id: 'br', staff_id: 's', service_id: 'sv', start_at: '2030-01-07T05:00:00Z',
            duration_min: 30, client_id: null, client_name: 'A', client_phone: '+996555123456',
        });
        const slot = { staff_id: 's', branch_id: 'br', start_at: 'x', end_at: 'y' };
        expect(uniqueSlots([slot, { ...slot }, { ...slot, start_at: 'z' }])).toHaveLength(2);
    });
});

describe('server answers of refused commands', () => {
    test('the server text is shown when it is in the app language and not technical', () => {
        const ru = createTranslate('ru');
        const en = createTranslate('en');
        expect(isReadableServerMessage('У сотрудника есть история', 'ru')).toBe(true);
        expect(isReadableServerMessage('staff_action_failed', 'en')).toBe(false);
        expect(isReadableServerMessage('У сотрудника есть история', 'en')).toBe(false);
        const conflict = Object.assign(new Error('Есть будущие записи'), { status: 409 });
        expect(staffErrorMessage(conflict, 'fallback', ru)).toBe('Есть будущие записи');
        expect(staffErrorMessage(Object.assign(new Error('staff_action_failed'), { status: 500 }), 'fallback', en)).toBe(en('cabinet.error.unavailable'));
    });
});
