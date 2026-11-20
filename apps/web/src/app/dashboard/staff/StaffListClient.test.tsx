/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import StaffListClient from './StaffListClient';

const refresh = jest.fn();

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), refresh }) }));
jest.mock('./ActionButtons', () => ({ __esModule: true, default: () => null }));

const rows = [
    { id: 'staff-pending', full_name: 'Invited Person', is_active: true, branch_id: 'b1', branches: { name: 'Main' } },
    { id: 'staff-linked', full_name: 'Linked Person', is_active: true, branch_id: 'b1', branches: { name: 'Main' } },
];

beforeEach(() => {
    refresh.mockClear();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as unknown as typeof fetch;
});

test('a card with a pending invitation shows the badge and the cancel button (API-06)', () => {
    render(<StaffListClient initialRows={rows} pendingInvitationStaffIds={['staff-pending']} />);

    expect(screen.getAllByText('Ожидает подтверждения')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Отменить приглашение' })).toHaveLength(1);
    const card = screen.getByText('Invited Person').closest('.group');
    expect(card?.textContent).toContain('Ожидает подтверждения');
});

test('no badge without pending invitations', () => {
    render(<StaffListClient initialRows={rows} />);
    expect(screen.queryByText('Ожидает подтверждения')).toBeNull();
});

test('cancelling calls the cancel route and refreshes the list', async () => {
    render(<StaffListClient initialRows={rows} pendingInvitationStaffIds={['staff-pending']} />);

    fireEvent.click(screen.getByRole('button', { name: 'Отменить приглашение' }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(global.fetch).toHaveBeenCalledWith('/api/staff/staff-pending/invitation/cancel', { method: 'POST' });
});
