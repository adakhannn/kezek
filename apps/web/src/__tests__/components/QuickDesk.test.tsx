/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuickDesk } from '@/app/dashboard/bookings/components/QuickDesk';
import { bookingsRu } from '@/app/_components/i18n/dictionaries/bookings.ru';
import { createInternalBooking, getFreeSlotsForServiceDay } from '@/lib/bookingDashboardService';

const mockTransfers: { staff_id: string; branch_id: string; date: string }[] = [];
const mockServiceMap = new Map([['service1', new Set(['staff1'])]]);
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({locale: 'ru', t: (key: string, fallback: string) => bookingsRu[key as keyof typeof bookingsRu] ?? fallback}),
}));
jest.mock('@/app/dashboard/bookings/components/useTemporaryTransfers', () => ({useTemporaryTransfers: () => mockTransfers}));
jest.mock('@/app/dashboard/bookings/components/useServiceStaffMap', () => ({useServiceStaffMap: () => mockServiceMap}));
jest.mock('@/app/dashboard/bookings/components/SellVisitPackageModal', () => ({SellVisitPackageModal: () => null}));
jest.mock('@/lib/bookingDashboardService', () => ({getFreeSlotsForServiceDay: jest.fn(), createInternalBooking: jest.fn()}));
jest.mock('@/lib/funnelEvents', () => ({trackFunnelEvent: jest.fn(), getSessionId: () => 'test-session'}));
jest.mock('@/app/dashboard/bookings/notify', () => ({notify: jest.fn().mockResolvedValue(undefined)}));

const props = {
    bizId: 'biz1', timezone: 'Asia/Bishkek',
    branches: [{id: 'branch1', name: 'Branch One'}, {id: 'branch2', name: 'Branch Two'}],
    staff: [{id: 'staff1', branch_id: 'branch1', full_name: 'Staff One'}],
    services: [{id: 'service1', branch_id: 'branch1', name_ru: 'Service One', duration_min: 60}],
};
const slot = {staff_id: 'staff1', branch_id: 'branch1', start_at: '2030-10-14T03:00:00Z', end_at: '2030-10-14T04:00:00Z'};
beforeEach(() => {
    jest.clearAllMocks(); mockTransfers.splice(0);
    jest.mocked(getFreeSlotsForServiceDay).mockResolvedValue([slot]);
    jest.mocked(createInternalBooking).mockResolvedValue('test-booking-id');
});
function chooseVisit() {
    fireEvent.change(screen.getByLabelText('Филиал'), {target: {value: 'branch1'}});
    fireEvent.change(screen.getByLabelText('Дата'), {target: {value: '2030-10-14'}});
    fireEvent.change(screen.getByLabelText('Мастер'), {target: {value: 'staff1'}});
    fireEvent.change(screen.getByLabelText('Услуга'), {target: {value: 'service1'}});
}
const createButton = () => screen.getByRole('button', {name: 'Создать запись'}) as HTMLButtonElement;

it('exposes all scheduling inputs and only creates from a real available slot', async () => {
    render(<QuickDesk {...props} />);
    expect(createButton().disabled).toBe(true);
    for (const label of ['Филиал', 'Дата', 'Мастер', 'Услуга', 'Время']) expect(screen.getByLabelText(label)).toBeTruthy();
    chooseVisit();
    await waitFor(() => expect(createButton().disabled).toBe(false));
    expect(screen.getByRole('option', {name: '09:00–10:00'})).toBeTruthy();
    fireEvent.click(createButton());
    await waitFor(() => expect(createInternalBooking).toHaveBeenCalledWith({
        bizId: 'biz1', branchId: 'branch1', serviceId: 'service1', staffId: 'staff1',
        startAtISO: slot.start_at, minutes: 60, clientId: null, clientName: null, clientPhone: null,
    }));
    await waitFor(() => expect(screen.getByText('Создана запись #test-boo')).toBeTruthy());
    expect(createButton().disabled).toBe(true);
});

it('never enables creation while loading or when the selected service has no free time', async () => {
    let resolveSlots!: (slots: typeof slot[]) => void;
    jest.mocked(getFreeSlotsForServiceDay).mockReturnValue(new Promise(resolve => {resolveSlots = resolve;}));
    render(<QuickDesk {...props} />); chooseVisit();
    expect(screen.getByText('Загрузка слотов...')).toBeTruthy();
    expect(createButton().disabled).toBe(true);
    resolveSlots([]);
    await waitFor(() => expect(screen.getByText('Нет свободных слотов')).toBeTruthy());
    expect(createButton().disabled).toBe(true);
});

it('clears stale selections on date and branch changes and excludes staff from another branch', async () => {
    render(<QuickDesk {...props} />); chooseVisit();
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.change(screen.getByLabelText('Дата'), {target: {value: '2030-10-15'}});
    expect(createButton().disabled).toBe(true);
    expect((screen.getByLabelText('Мастер') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Услуга') as HTMLSelectElement).value).toBe('');
    fireEvent.change(screen.getByLabelText('Филиал'), {target: {value: 'branch2'}});
    expect(screen.queryByRole('option', {name: 'Staff One'})).toBeNull();
    expect(createButton().disabled).toBe(true);
});

it('uses existing domain work-location resolution for a temporary branch transfer', () => {
    mockTransfers.push({staff_id: 'staff1', branch_id: 'branch2', date: '2030-10-14'});
    render(<QuickDesk {...props} />);
    fireEvent.change(screen.getByLabelText('Филиал'), {target: {value: 'branch2'}});
    fireEvent.change(screen.getByLabelText('Дата'), {target: {value: '2030-10-14'}});
    expect(screen.getByRole('option', {name: 'Staff One'})).toBeTruthy();
    expect(createButton().disabled).toBe(true);
});

it('renders booking failures rather than silently resetting the form', async () => {
    jest.mocked(createInternalBooking).mockRejectedValueOnce(new Error('SLOT_BUSY'));
    render(<QuickDesk {...props} />); chooseVisit();
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(createButton());
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('SLOT_BUSY'));
    expect((screen.getByLabelText('Услуга') as HTMLSelectElement).value).toBe('service1');
});

it('requires client data in new-client mode instead of using the no-client payload', async () => {
    render(<QuickDesk {...props} />); chooseVisit();
    await waitFor(() => expect(createButton().disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', {name: 'Новый клиент Звонок/лично'}));
    expect(createButton().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Имя'), {target: {value: 'LIVE TEST'}});
    expect(createButton().disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('Телефон'), {target: {value: '+996500123456'}});
    expect(createButton().disabled).toBe(false);
});
