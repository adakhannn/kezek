/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RoleApplicationForm } from '@/app/business/role-apply/RoleApplicationForm';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (key: string) => key }),
}));

describe('staff application form', () => {
    beforeEach(() => {
        global.fetch = jest.fn(async (url, options) => ({
            ok: true,
            text: async () => JSON.stringify({ ok: true, items: [] }),
            json: async () => options?.method === 'POST'
                ? { ok: true, id: 'application-1' }
                : { ok: true, items: String(url).includes('/businesses/search') ? [{ id: 'biz-1', name: 'Test business', slug: null }] : [] },
        })) as jest.Mock;
    });
    test('shows no identity card or warning for a completed profile', async () => {
        const { container } = render(<RoleApplicationForm isAuthenticated mode="staff" />);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.queryByText('business.roleApply.form.applicant.title')).toBeNull();
        expect(screen.queryByText('business.roleApply.form.applicant.missingName')).toBeNull();
        expect(container.querySelector('select')).toBeNull();
        expect(container.querySelector('details')?.open).toBe(false);
        const comment = container.querySelector('textarea')!;
        expect(comment.required).toBe(false);
        fireEvent.change(comment, { target: { value: 'Optional context' } });
        expect(comment.value).toBe('Optional context');
    });
    test('submits without comment and never sends applicant identity from the client', async () => {
        render(<RoleApplicationForm isAuthenticated mode="staff" />);
        const search = screen.getByRole('combobox');
        fireEvent.change(search, { target: { value: 'Test' } });
        fireEvent.click(await screen.findByRole('option'));
        fireEvent.click(screen.getByRole('button', { name: 'business.roleApply.form.submit' }));
        await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/business-role-applications', expect.objectContaining({ method: 'POST' })));
        const post = (fetch as jest.Mock).mock.calls.find(([, opts]) => opts?.method === 'POST');
        expect(JSON.parse(post[1].body)).toEqual({ biz_id: 'biz-1', requested_role: 'staff', message: '', evidence_links: { instagram: '', two_gis: '', google_maps: '', yandex_maps: '' } });
        await screen.findByText('business.roleApply.form.success.title');
    });
    test('keeps owner evidence and explanation visible', async () => {
        const { container } = render(<RoleApplicationForm isAuthenticated mode="owner" />);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(container.querySelector('details')).toBeNull();
        expect(screen.getByText('business.roleApply.form.evidence.label')).toBeTruthy();
        expect(screen.getByLabelText('business.roleApply.form.comment.ownerLabel')).toBeTruthy();
    });
    test('shows a profile link only when the authenticated applicant has no profile name', async () => {
        render(<RoleApplicationForm isAuthenticated mode="staff" needsProfileName />);
        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.getByText('business.roleApply.form.applicant.missingName')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'business.roleApply.form.applicant.edit' }).getAttribute('href')).toBe('/cabinet/profile');
    });
});
