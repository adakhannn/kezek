/** @jest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { cabinetEn } from '@/app/_components/i18n/dictionaries/cabinet.en';
import { cabinetKy } from '@/app/_components/i18n/dictionaries/cabinet.ky';
import { cabinetRu } from '@/app/_components/i18n/dictionaries/cabinet.ru';
import StaffInvitationsBlock from '@/app/cabinet/components/StaffInvitationsBlock';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

const dictionaries = { ru: cabinetRu, ky: cabinetKy, en: cabinetEn } as const;
const fetchMock = jest.fn();
const json = (body: unknown) => ({ json: async () => body });
const invitation = { id: 'inv-1', biz_id: 'biz-1', staff_id: 'card-1', business_name: 'Salon', branch_name: 'Center', created_at: '2026-11-19T10:00:00Z' };

function useLocale(locale: keyof typeof dictionaries) {
    const dictionary = dictionaries[locale] as Record<string, string>;
    jest.mocked(useLanguage).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key } as ReturnType<typeof useLanguage>);
    return dictionary;
}

beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock;
});
afterEach(cleanup);

// API-06: the person sees and answers the invitations to a business team.
describe('StaffInvitationsBlock', () => {
    test('renders nothing when there are no invitations', async () => {
        useLocale('ru');
        fetchMock.mockResolvedValue(json({ ok: true, data: { invitations: [] } }));
        const { container } = render(<StaffInvitationsBlock />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/staff-invitations', { cache: 'no-store' }));
        expect(container.innerHTML).toBe('');
    });

    test('renders nothing when the list cannot be loaded', async () => {
        useLocale('ru');
        fetchMock.mockRejectedValue(new Error('offline'));
        const { container } = render(<StaffInvitationsBlock />);
        await waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(container.innerHTML).toBe('');
    });

    test.each(['ru', 'ky', 'en'] as const)('lists pending invitations in %s', async (locale) => {
        const dictionary = useLocale(locale);
        fetchMock.mockResolvedValue(json({ ok: true, data: { invitations: [invitation] } }));
        render(<StaffInvitationsBlock />);

        expect(await screen.findByText('Salon')).toBeTruthy();
        expect(screen.getByRole('heading', { name: dictionary['cabinet.staffInvitations.title'] })).toBeTruthy();
        expect(screen.getByText(dictionary['cabinet.staffInvitations.branch'].replace('{branch}', 'Center'))).toBeTruthy();
        expect(screen.getByRole('button', { name: dictionary['cabinet.staffInvitations.accept'] })).toBeTruthy();
        expect(screen.getByRole('button', { name: dictionary['cabinet.staffInvitations.decline'] })).toBeTruthy();
    });

    test('accepting links the card and points to the staff cabinet', async () => {
        const dictionary = useLocale('ru');
        fetchMock
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [invitation] } }))
            .mockResolvedValueOnce(json({ ok: true, data: { staff_id: 'card-1', biz_id: 'biz-1' } }))
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [] } }));
        render(<StaffInvitationsBlock />);

        fireEvent.click(await screen.findByRole('button', { name: dictionary['cabinet.staffInvitations.accept'] }));

        expect(await screen.findByRole('status')).toBeTruthy();
        expect(screen.getByRole('status').textContent).toContain(dictionary['cabinet.staffInvitations.accepted']);
        expect(screen.getByRole('link', { name: dictionary['cabinet.staffInvitations.openStaffCabinet'] }).getAttribute('href')).toBe('/staff');
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/staff-invitations/inv-1/accept', { method: 'POST' });
        expect(screen.queryByText('Salon')).toBeNull();
    });

    test('declining removes the invitation and the block', async () => {
        const dictionary = useLocale('ru');
        fetchMock
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [invitation] } }))
            .mockResolvedValueOnce(json({ ok: true }))
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [] } }));
        const { container } = render(<StaffInvitationsBlock />);

        fireEvent.click(await screen.findByRole('button', { name: dictionary['cabinet.staffInvitations.decline'] }));

        await waitFor(() => expect(container.innerHTML).toBe(''));
        expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/staff-invitations/inv-1/decline', { method: 'POST' });
    });

    test('a refused answer shows the server message', async () => {
        const dictionary = useLocale('ru');
        fetchMock
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [invitation] } }))
            .mockResolvedValueOnce(json({ ok: false, error: 'conflict', message: 'Вы уже в команде этого бизнеса' }))
            .mockResolvedValueOnce(json({ ok: true, data: { invitations: [invitation] } }));
        render(<StaffInvitationsBlock />);

        fireEvent.click(await screen.findByRole('button', { name: dictionary['cabinet.staffInvitations.accept'] }));

        expect((await screen.findByRole('alert')).textContent).toBe('Вы уже в команде этого бизнеса');
    });
});
