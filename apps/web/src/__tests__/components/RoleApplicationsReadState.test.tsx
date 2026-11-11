/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { RoleApplicationsClient } from '@/app/dashboard/role-applications/RoleApplicationsClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));

const emptyTitle = 'Заявок сотрудников пока нет';
const branch = { id: 'unit-branch', name: 'UNIT BRANCH', address: null, is_active: true };
type Status = 'pending' | 'approved' | 'rejected' | 'cancelled';
function application(status: Status, id = status) {
    return {
        id: `unit-application-${id}`, applicant_user_id: `unit-user-${id}`,
        requested_role: 'staff', status, applicant_name: `UNIT ${status}`,
        applicant_email: null, applicant_phone: null, message: null,
        created_at: '2026-10-12T03:00:00Z', reviewed_at: null, review_note: null,
        prior_submission_count: 0, risk_flags: [], active_block_id: null,
    };
}
let originalFetch: typeof fetch;
let payload: { ok: boolean; items: ReturnType<typeof application>[]; branches: typeof branch[] };
let expectedReads: number;

beforeEach(() => {
    originalFetch = global.fetch;
    payload = { ok: true, items: [], branches: [branch] };
    expectedReads = 1;
    // In-memory GET only. Any command or unexpected endpoint fails the test.
    global.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
        if (url !== '/dashboard/api/role-applications' || init?.method) {
            throw new Error('Unexpected unit request: mutations are not allowed');
        }
        return { ok: true, json: async () => payload };
    }) as jest.Mock;
});
afterEach(() => {
    expect(global.fetch).toHaveBeenCalledTimes(expectedReads);
    for (let call = 1; call <= expectedReads; call++) {
        expect(global.fetch).toHaveBeenNthCalledWith(call, '/dashboard/api/role-applications', { cache: 'no-store' });
    }
    global.fetch = originalFetch;
});

it('does not claim an empty list or show moderation controls while the read is pending', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<RoleApplicationsClient />);
    expect(screen.getByText('Загружаем заявки…')).toBeTruthy();
    expect(screen.queryByText(emptyTitle)).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
});

it('shows a confirmed empty list after a successful read with an active branch', async () => {
    render(<RoleApplicationsClient />);
    await screen.findByText(emptyTitle);
    expect(screen.queryByText('Нужен филиал')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
});

it('shows branch setup guidance only for a successful result without branches', async () => {
    payload.branches = [];
    render(<RoleApplicationsClient />);
    await screen.findByText(emptyTitle);
    expect(screen.getByText('Нужен филиал')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Перейти к филиалам' }).getAttribute('href')).toBe('/dashboard/branches');
});

it('renders all four read statuses and offers actions only for the pending row', async () => {
    payload.items = (['pending', 'approved', 'rejected', 'cancelled'] as const).map((status) => application(status));
    render(<RoleApplicationsClient />);
    await screen.findByText('UNIT pending');
    for (const label of ['Ожидает решения', 'Принят', 'Отклонён', 'Отменён']) {
        expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByRole('button', { name: 'Настроить и принять' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Отклонить', exact: true })).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Принять сотрудника', exact: true })).toBeNull();
    expect(screen.queryByText(emptyTitle)).toBeNull();
});

it('disables the pending approval entry when no branch is available without making a command', async () => {
    payload.items = [application('pending')];
    payload.branches = [];
    render(<RoleApplicationsClient />);
    const button = await screen.findByRole('button', { name: 'Настроить и принять' });
    expect((button as HTMLButtonElement).disabled).toBe(true);
});

it('uses neutral name and user id fallbacks when optional contact fields are absent', async () => {
    const item = application('approved');
    payload.items = [{ ...item, applicant_name: '' }];
    render(<RoleApplicationsClient />);
    await screen.findByText('Пользователь Kezek');
    expect(screen.getByText(item.applicant_user_id)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Настроить и принять' })).toBeNull();
});

it('renders applicant text as literal content rather than interpreting markup', async () => {
    const message = '<script>unit-only</script>';
    const item = { ...application('rejected'), message };
    payload.items = [item as ReturnType<typeof application>];
    const { container } = render(<RoleApplicationsClient />);
    await screen.findByText(message);
    expect(container.querySelector('script')).toBeNull();
});

// Isolated read-state regression tests, not claims of live UI acceptance.
it.each(['network', 'http', 'json'] as const)('does not advertise a confirmed empty list after a %s failure', async (failure) => {
    const message = `UNIT ${failure} load failure`;
    if (failure === 'network') (global.fetch as jest.Mock).mockRejectedValue(new Error(message));
    if (failure === 'http') (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ ok: false, message }) });
    if (failure === 'json') (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => { throw new Error(message); } });
    render(<RoleApplicationsClient />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(message);
    expect(screen.queryByText(emptyTitle)).toBeNull();
    expect(screen.queryByText('Нужен филиал')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Настроить и принять' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close banner' })).toBeNull();
});

it('keeps the result unknown during retry and shows an empty list only after retry succeeds', async () => {
    expectedReads = 2;
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('unit initial read failure'));
    render(<RoleApplicationsClient />);
    await screen.findByRole('alert');
    let resolveRetry!: (value: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(resolve => { resolveRetry = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    expect(screen.getByText('Загружаем заявки…')).toBeTruthy();
    expect(screen.queryByText(emptyTitle)).toBeNull();
    expect(screen.queryByText('Нужен филиал')).toBeNull();
    await act(async () => resolveRetry({ ok: true, json: async () => payload }));
    await screen.findByText(emptyTitle);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('Нужен филиал')).toBeNull();
});
