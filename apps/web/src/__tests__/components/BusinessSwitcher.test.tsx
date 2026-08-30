/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LanguageProvider } from '@/app/_components/i18n/LanguageProvider';
import { BusinessSwitcher } from '@/app/dashboard/components/BusinessSwitcher';

const refresh = jest.fn();
const fetchMock = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ refresh }),
}));

jest.mock('@/lib/log', () => ({
    logWarn: jest.fn(),
}));

const businesses = [
    { id: 'biz-1', name: 'Business One', city: null, slug: 'one' },
    { id: 'biz-2', name: 'Business Two', city: 'Osh', slug: 'two' },
];

function getResponse() {
    return {
        ok: true,
        json: async () => ({ ok: true, data: { currentBizId: 'biz-1', businesses } }),
    };
}

function renderSwitcher(serverCurrentBizId: string) {
    return (
        <LanguageProvider>
            <BusinessSwitcher serverCurrentBizId={serverCurrentBizId} />
        </LanguageProvider>
    );
}

describe('BusinessSwitcher', () => {
    beforeEach(() => {
        refresh.mockReset();
        fetchMock.mockReset();
        global.fetch = fetchMock;
        window.localStorage.clear();
        document.cookie = 'kezek_lang=; max-age=0; path=/';
        document.cookie = 'kezek_lang=en; path=/';
        window.localStorage.setItem('kezek_locale', 'en');
    });

    it('keeps a visible blocking loader until the refreshed workspace confirms the new business', async () => {
        let resolveSwitch!: (value: unknown) => void;
        const switchRequest = new Promise((resolve) => {
            resolveSwitch = resolve;
        });
        fetchMock.mockResolvedValueOnce(getResponse()).mockReturnValueOnce(switchRequest);

        const view = render(renderSwitcher('biz-1'));
        const trigger = await screen.findByRole('button', { name: 'Business One' });
        fireEvent.click(trigger);
        fireEvent.click(screen.getByRole('option', { name: 'Business Two Osh' }));

        const loader = await screen.findByRole('status');
        expect(loader.textContent).toContain('Switching business');
        expect(loader.textContent).toContain('Business Two');
        expect(trigger.getAttribute('disabled')).not.toBeNull();

        await act(async () => {
            resolveSwitch({ ok: true, json: async () => ({ ok: true }) });
            await switchRequest;
        });
        await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
        expect(screen.getByRole('status')).toBeTruthy();

        view.rerender(renderSwitcher('biz-2'));
        await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
        expect(screen.getByRole('button', { name: 'Business Two · Osh' })).toBeTruthy();
    });

    it('removes the loader and preserves the switcher when the request fails', async () => {
        fetchMock
            .mockResolvedValueOnce(getResponse())
            .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });

        render(renderSwitcher('biz-1'));
        fireEvent.click(await screen.findByRole('button', { name: 'Business One' }));
        fireEvent.click(screen.getByRole('option', { name: 'Business Two Osh' }));

        expect((await screen.findByRole('alert')).textContent).toContain('Could not switch business');
        expect(screen.queryByRole('status')).toBeNull();
        expect(screen.getByRole('button', { name: 'Business One' })).toBeTruthy();
        expect(refresh).not.toHaveBeenCalled();
    });
});
