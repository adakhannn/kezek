/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UserSecurityActions } from '@/components/admin/users/UserSecurityActions';
jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/components/ui/AlertBanner', () => ({ AlertBanner: ({ message }: { message: string }) => <div>{message}</div> }));
jest.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));

beforeEach(() => jest.clearAllMocks());
test('uses returned role state, not the optimistic requested value', async () => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ok: true, data: { isSuperAdmin: false } }) } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('checkbox'));
    await screen.findByText('Супер-админ снят');
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(fetch).toHaveBeenCalledWith('/admin/api/users/target/toggle-super', expect.objectContaining({ body: '{"makeSuper":true}' }));
});
test.each([{ ok: true }, { ok: true, data: { isSuperAdmin: 'true' } }])('does not announce success for an unconfirmed response %j', async payload => {
    jest.mocked(fetch).mockResolvedValue({ ok: true, json: async () => payload } as Response);
    render(<UserSecurityActions userId="target" isSuper={false} isBlocked={false} />);
    fireEvent.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(screen.getByText('Не удалось подтвердить состояние роли')).toBeTruthy());
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText('Назначен супер-админом')).toBeNull();
});
