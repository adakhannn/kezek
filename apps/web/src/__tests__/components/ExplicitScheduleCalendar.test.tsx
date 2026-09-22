/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ScheduleCalendar from '@/components/scheduling/ScheduleCalendar';
import ScheduleEditor from '@/components/scheduling/ScheduleEditor';

const snapshot = { revision: 0, timezone: 'Asia/Bishkek', today: '2026-09-18', days: [{ date: '2026-09-18', branch_id: 'branch', source: 'unconfigured', intervals: [], breaks: [] }] };
describe('explicit schedule screens', () => {
    const originalFetch = global.fetch;
    afterEach(() => { global.fetch = originalFetch; });
    test('viewing does not create a graph or invent 09:00 hours', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: snapshot }) });
        render(<ScheduleCalendar endpoint="/api/staff/me/schedule" branches={[]} />);
        await screen.findByText('График пока не назначен');
        expect(screen.queryByText(/09:00/)).toBeNull();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith('/api/staff/me/schedule', expect.objectContaining({ cache: 'no-store' }));
    });
    test('network failure is not rendered as an empty schedule', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Связь прервана'));
        render(<ScheduleCalendar endpoint="/api/staff/me/schedule" branches={[]} />);
        await screen.findByRole('alert');
        expect(screen.queryByText('График пока не назначен')).toBeNull();
    });
    test('calendar navigation requests another period without writing', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: snapshot }) });
        render(<ScheduleCalendar endpoint="/api/staff/me/schedule" branches={[]} />);
        await screen.findByText('График пока не назначен');
        fireEvent.click(screen.getByRole('button', { name: 'scheduling.next' }));
        await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/staff/me/schedule?from=2026-10-02', expect.objectContaining({ cache: 'no-store' })));
    });
    test('loads the existing plan into a draft without publishing', async () => {
        const branchId = '00000000-0000-0000-0000-000000000001';
        const days = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { intervals: i ? [] : [{ start: '10:00', end: '16:00' }], breaks: [] }]));
        global.fetch = jest.fn().mockImplementation((url: string) => Promise.resolve({ ok: true,
            json: async () => ({ ok: true, data: url.includes('draftKind') ? { days, branchId, revision: 0, source: 'week' } : snapshot }) }));
        render(<ScheduleEditor staffId="staff" homeBranchId={branchId} branches={[{ id: branchId, name: 'Филиал' }]} />);
        await waitFor(() => expect((screen.getByLabelText('Действует с') as HTMLInputElement).value).toBe(snapshot.today));
        fireEvent.click(screen.getByRole('button', { name: 'Загрузить действующий план в черновик' }));
        await screen.findByDisplayValue('10:00');
        expect((global.fetch as jest.Mock).mock.calls.every(([, init]) => !init.method)).toBe(true);
    });
    test('editing requires preview and explicit publication; no writes on mount', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: snapshot }) });
        render(<ScheduleEditor staffId="staff" homeBranchId="00000000-0000-0000-0000-000000000001" branches={[{ id: '00000000-0000-0000-0000-000000000001', name: 'Филиал' }]} />);
        await screen.findByText('График пока не назначен');
        await waitFor(() => expect((screen.getByLabelText('Действует с') as HTMLInputElement).value).toBe('2026-09-18'));
        fireEvent.click(screen.getByRole('button', { name: 'Проверить изменения' }));
        await waitFor(() => expect(screen.getByRole('button', { name: 'Подтвердить и опубликовать' })).not.toBeNull());
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
