import React from 'react';
import { render, screen, within } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';

import StaffScheduleScreen from '../../screens/StaffScheduleScreen';
import { dayFromEffective } from '../../screens/staffSchedule/useStaffScheduleData';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { addDaysYmd, businessWeekYmds, isoWeekdayOfYmd } from '../../utils/businessWeek';
import { staffCard, staffCardsQuery } from '../staffCards';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test-user-id' } }) }));
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const from = supabase.from as jest.Mock;
const TZ = 'Asia/Bishkek';
const week = businessWeekYmds(0, TZ);
const lastDay = businessWeekYmds(1, TZ)[6];

type Builder = Record<'select' | 'eq' | 'gte' | 'lt' | 'order', jest.Mock> & { then: (resolve: (value: unknown) => unknown) => Promise<unknown> };
function query(result: { data: unknown; error: Error | null }): Builder {
    const builder = {} as Builder;
    for (const method of ['select', 'eq', 'gte', 'lt', 'order'] as const) builder[method] = jest.fn(() => builder);
    builder.then = (resolve) => Promise.resolve(result).then(resolve);
    return builder;
}

let rulesQuery: Builder | null = null;
function mockTables(rules: unknown[] = []) {
    rulesQuery = null;
    from.mockImplementation((table: string) => {
        if (table === 'staff') {
            return staffCardsQuery([staffCard({ id: 'staff-1', biz_id: 'biz-1', branch: { id: 'home', name: 'Центр' }, business: { id: 'biz-1', name: 'Low Fade', tz: TZ } })]);
        }
        if (table === 'branches') return query({ data: [{ id: 'home', name: 'Центр' }, { id: 'other', name: 'Юг' }], error: null });
        if (table === 'staff_schedule_rules') {
            rulesQuery = query({ data: rules, error: null });
            return rulesQuery;
        }
        throw new Error(`unexpected table ${table}`);
    });
}

const renderScreen = () => render(
    <QueryClientProvider client={createTestQueryClient()}>
        <StaffScheduleScreen />
    </QueryClientProvider>,
);

beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
});

describe('StaffScheduleScreen (S3)', () => {
    test('the explicit model: this week and next in the business zone, with the card in the header', async () => {
        mockTables();
        api.mockResolvedValue({ ok: true, data: { revision: 3, timezone: TZ, today: week[0], days: [
            { date: week[0], intervals: [{ start: '09:00', end: '18:00' }], breaks: [{ start: '13:00', end: '14:00' }], branch_id: 'home', tz: TZ, source: 'week' },
            { date: week[1], intervals: [{ start: '10:00', end: '16:00' }], breaks: [], branch_id: 'other', tz: TZ, source: 'day' },
            { date: week[2], intervals: [], breaks: [], branch_id: null, tz: TZ, source: 'week' },
            { date: week[3], intervals: [], breaks: [], branch_id: null, tz: TZ, source: 'absence' },
        ] } });

        renderScreen();

        const monday = await screen.findByTestId(`schedule-day-${week[0]}`);
        expect(within(monday).getByText('09:00–18:00')).toBeTruthy();
        expect(within(monday).getByText('Перерыв: 13:00–14:00')).toBeTruthy();
        expect(within(monday).getByText('Филиал: Центр')).toBeTruthy();
        expect(within(screen.getByTestId(`schedule-day-${week[1]}`)).getByText('Временный филиал: Юг')).toBeTruthy();
        expect(within(screen.getByTestId(`schedule-day-${week[2]}`)).getByText('Выходной')).toBeTruthy();
        expect(within(screen.getByTestId(`schedule-day-${week[3]}`)).getByText('Отсутствие')).toBeTruthy();
        expect(within(screen.getByTestId(`schedule-day-${week[4]}`)).getByText('Не настроено')).toBeTruthy();
        expect(screen.getByText('Текущая неделя')).toBeTruthy();
        expect(screen.getByText('Следующая неделя')).toBeTruthy();
        expect(api).toHaveBeenCalledWith(`/api/staff/me/schedule?from=${week[0]}&to=${lastDay}`, { headers: { 'x-kezek-staff-id': 'staff-1' } });
        expect(isoWeekdayOfYmd(week[0])).toBe(1);
        expect(rulesQuery).toBeNull();
    });

    test('while the explicit model is off (503) the dated rules are read, like the website', async () => {
        mockTables([{ date_on: week[0], intervals: [{ start: '08:00', end: '12:00' }], branch_id: 'home' }, { date_on: week[1], intervals: [], branch_id: null }]);
        api.mockRejectedValue(Object.assign(new Error('off'), { status: 503 }));

        renderScreen();

        const monday = await screen.findByTestId(`schedule-day-${week[0]}`);
        expect(within(monday).getByText('08:00–12:00')).toBeTruthy();
        expect(within(screen.getByTestId(`schedule-day-${week[1]}`)).getByText('Выходной')).toBeTruthy();
        expect(rulesQuery?.eq).toHaveBeenCalledWith('staff_id', 'staff-1');
        expect(rulesQuery?.eq).toHaveBeenCalledWith('kind', 'date');
        expect(rulesQuery?.gte).toHaveBeenCalledWith('date_on', week[0]);
        expect(rulesQuery?.lt).toHaveBeenCalledWith('date_on', addDaysYmd(lastDay, 1));
    });

    test('another failure is an error, not an empty schedule', async () => {
        mockTables();
        api.mockRejectedValue(Object.assign(new Error('down'), { status: 500 }));

        renderScreen();

        expect(await screen.findByText('Не удалось загрузить расписание')).toBeTruthy();
        expect(rulesQuery).toBeNull();
    });
});

describe('dayFromEffective', () => {
    test('maps the explicit sources to what the master sees', () => {
        const base = { date: '2026-11-23', breaks: [], branch_id: null };
        expect(dayFromEffective({ ...base, intervals: [{ start: '09:00', end: '10:00' }], source: 'legacy' }).kind).toBe('working');
        expect(dayFromEffective({ ...base, intervals: [], source: 'day' }).kind).toBe('off');
        expect(dayFromEffective({ ...base, intervals: [], source: 'absence' }).kind).toBe('absence');
        expect(dayFromEffective({ ...base, intervals: [], source: 'unconfigured' }).kind).toBe('unconfigured');
    });
});
