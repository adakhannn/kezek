/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import Client from '@/app/dashboard/staff/[id]/slots/Client';
import { createInternalBooking, getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback: string) => fallback }) }));
jest.mock('@/lib/bookingDashboardService', () => ({ createInternalBooking: jest.fn(), getFreeSlotsForServiceDay: jest.fn() }));
jest.mock('@/components/pickers/DatePickerPopover', () => ({ __esModule: true, default: () => null }));

const slot = (start: string, end: string) => ({ staff_id: 'staff-1', branch_id: 'branch-1', start_at: start, end_at: end });
const props = {
    bizId: 'biz-1',
    staffId: 'staff-1',
    staffName: 'Адахан',
    services: [{ id: 'svc-1', name: 'Стрижка', duration_min: 60, branch_id: 'branch-1' }],
    branches: [{ id: 'branch-1', name: 'Центр' }],
    defaultDate: '2999-01-10',
};

async function chooseService() {
    render(<Client {...props} />);
    const [branchSelect, serviceSelect] = screen.getAllByRole('combobox');
    fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
    fireEvent.change(serviceSelect, { target: { value: 'svc-1' } });
    return screen.findByRole('button', { name: /10:00/ });
}

beforeEach(() => {
    jest.clearAllMocks();
    (getFreeSlotsForServiceDay as jest.Mock).mockResolvedValue([
        slot('2999-01-10T04:00:00Z', '2999-01-10T05:00:00Z'),
        slot('2999-01-10T05:00:00Z', '2999-01-10T06:00:00Z'),
    ]);
});

describe('staff free slots (FE-12)', () => {
    test('a click on a slot only selects it; nothing is created without the confirmation', async () => {
        const first = await chooseService();

        fireEvent.click(first);

        expect(first.getAttribute('aria-pressed')).toBe('true');
        expect(screen.getByText('Подтвердить запись', { selector: 'h3' })).toBeTruthy();
        expect(screen.getByText('Адахан')).toBeTruthy();
        expect(createInternalBooking).not.toHaveBeenCalled();
    });

    test('the confirmation creates one booking with the chosen client mode, double clicks included', async () => {
        let resolve!: (id: string) => void;
        (createInternalBooking as jest.Mock).mockReturnValue(new Promise<string>((done) => { resolve = done; }));
        fireEvent.click(await chooseService());
        const confirm = screen.getByRole('button', { name: 'Подтвердить запись' });

        fireEvent.click(confirm);
        fireEvent.click(confirm);
        await act(async () => { resolve('abcdef12-0000-0000-0000-000000000000'); });

        expect(createInternalBooking).toHaveBeenCalledTimes(1);
        expect(createInternalBooking).toHaveBeenCalledWith(expect.objectContaining({
            bizId: 'biz-1', branchId: 'branch-1', serviceId: 'svc-1', staffId: 'staff-1', startAtISO: '2999-01-10T04:00:00Z', minutes: 60,
            clientId: null, clientName: null, clientPhone: null,
        }));
        await waitFor(() => expect(getFreeSlotsForServiceDay).toHaveBeenCalledTimes(2));
    });

    test('"Вернуться" drops the selection', async () => {
        fireEvent.click(await chooseService());
        fireEvent.click(screen.getByRole('button', { name: 'Вернуться' }));

        expect(screen.queryByText('Подтвердить запись', { selector: 'h3' })).toBeNull();
    });

    test('a failed slot load is shown as an error, not as "no free slots"', async () => {
        (getFreeSlotsForServiceDay as jest.Mock).mockRejectedValue(new Error('Сервис недоступен'));
        render(<Client {...props} />);
        const [branchSelect, serviceSelect] = screen.getAllByRole('combobox');
        fireEvent.change(branchSelect, { target: { value: 'branch-1' } });
        fireEvent.change(serviceSelect, { target: { value: 'svc-1' } });

        expect(await screen.findByText('Сервис недоступен')).toBeTruthy();
        expect(screen.queryByText('Нет свободных слотов')).toBeNull();
    });
});
