/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserSecurityActions } from '@/components/admin/users/UserSecurityActions';
const refresh = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
jest.mock('@/components/ui/AlertBanner', () => ({ AlertBanner: ({ message }: { message: string }) => <div>{message}</div> }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) => open ? <button onClick={onConfirm}>Подтвердить удаление</button> : null }));
beforeEach(() => jest.clearAllMocks());
test.each([undefined, 'true', false])('does not accept an unconfirmed block response %j', async blocked => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true, blocked }) } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Заблокировать' }));
    await screen.findByText('Не удалось подтвердить состояние блокировки');
    expect(refresh).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Разблокировать' }) as HTMLButtonElement).disabled).toBe(true);
});
test('confirmed block and unblock update state and refresh authoritative data', async () => {
    jest.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, blocked: true }) } as Response)
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, blocked: false }) } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Заблокировать' }));
    await screen.findByText('Пользователь заблокирован');
    fireEvent.click(screen.getByRole('button', { name: 'Разблокировать' }));
    await screen.findByText('Пользователь разблокирован');
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/admin/api/users/target/suspend', expect.objectContaining({ body: '{"block":false}' }));
});
test('uncertain block remains retryable without announcing success', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: false, status: 503, json: async () => ({ ok: false, error: 'Повторите то же действие' }) } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Заблокировать' }));
    await screen.findByText('Повторите то же действие');
    expect((screen.getByRole('button', { name: 'Заблокировать' }) as HTMLButtonElement).disabled).toBe(false);
    expect(refresh).not.toHaveBeenCalled();
});
test.each([{ ok: false, error: 'Передайте бизнес' }, {}])('does not navigate on a false or absent deletion acknowledgement %j', async payload => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => payload } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Удалить пользователя' }));
    fireEvent.click(screen.getByRole('button', { name: 'Подтвердить удаление' }));
    await waitFor(() => expect(screen.getByText('error' in payload ? payload.error : 'Не удалось подтвердить удаление')).toBeTruthy());
    expect((screen.getByRole('button', { name: 'Удалить пользователя' }) as HTMLButtonElement).disabled).toBe(false);
});
