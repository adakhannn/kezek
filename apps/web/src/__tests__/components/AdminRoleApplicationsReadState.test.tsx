/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RoleApplicationsAdminClient } from '@/app/admin/role-applications/RoleApplicationsAdminClient';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (key: string) => key }),
}));

const empty = 'admin.roleApplications.empty.title';
const loading = 'admin.roleApplications.loading';
const readError = 'UNIT read failure';
const item = {
    id: 'unit-admin-application', applicant_user_id: 'unit-user', biz_id: 'unit-biz',
    requested_role: 'staff', status: 'approved', applicant_name: 'UNIT applicant',
    applicant_email: null, applicant_phone: null, message: null,
    created_at: '2026-10-20T09:00:00Z', reviewed_at: null, review_note: null,
    evidence_links: {}, prior_submission_count: 0, risk_flags: [], active_block_id: null,
    businesses: { name: 'UNIT business', slug: 'unit-business' },
};
const success = (items: typeof item[] = []) => ({ ok: true, json: async () => ({ ok: true, items }) });
let originalFetch: typeof fetch;
beforeEach(() => {
    originalFetch = global.fetch;
    global.fetch = jest.fn(async (input: unknown, init?: RequestInit) => {
        if (typeof input !== 'string' || new URL(input).pathname !== '/admin/api/role-applications' || init?.method) {
            throw new Error('Unexpected UNIT endpoint or command');
        }
        return success();
    }) as jest.Mock;
});
afterEach(() => { global.fetch = originalFetch; });

it('does not show empty while the initial read is pending', () => {
    (global.fetch as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<RoleApplicationsAdminClient />);
    expect(screen.getByText(loading)).toBeTruthy();
    expect(screen.queryByText(empty)).toBeNull();
});

it('shows a confirmed empty list only after a successful read', async () => {
    render(<RoleApplicationsAdminClient />);
    await screen.findByText(empty);
    expect(screen.queryByRole('alert')).toBeNull();
});

it('shows successful rows without empty and without submitting moderation', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(success([item]));
    render(<RoleApplicationsAdminClient />);
    await screen.findByText('UNIT applicant');
    expect(screen.queryByText(empty)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it.each(['network', 'http', 'json'] as const)('does not claim an empty list on %s read failure', async failure => {
    if (failure === 'network') (global.fetch as jest.Mock).mockRejectedValue(new Error(readError));
    if (failure === 'http') (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ ok: false, message: readError }) });
    if (failure === 'json') (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => { throw new Error(readError); } });
    render(<RoleApplicationsAdminClient />);
    expect((await screen.findByRole('alert')).textContent).toContain(readError);
    expect(screen.queryByText(empty)).toBeNull();
});

it('does not certify an empty list when the read error banner is dismissed', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error(readError));
    render(<RoleApplicationsAdminClient />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Close banner' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(empty)).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('does not display stale rows as a different filter after its read fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(success([item])).mockRejectedValueOnce(new Error(readError));
    render(<RoleApplicationsAdminClient />);
    await screen.findByText('UNIT applicant');
    fireEvent.click(screen.getByRole('button', { name: 'admin.roleApplications.status.all' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('UNIT applicant')).toBeNull();
    expect(screen.queryByText(empty)).toBeNull();
});

it('recovers from a read failure through a successful read-only filter change', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(readError)).mockResolvedValueOnce(success());
    render(<RoleApplicationsAdminClient />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'admin.roleApplications.status.all' }));
    await screen.findByText(empty);
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(global.fetch).toHaveBeenCalledTimes(2);
});
