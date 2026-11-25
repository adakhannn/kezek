/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import { getT } from '@/app/_components/i18n/server';
import { BusinessTimeZoneSettingsForm } from '@/app/dashboard/settings/BusinessTimeZoneSettingsForm';
import { BusinessTimeZoneProvider, useBusinessTimeZone } from '@/components/BusinessTimeZoneContext';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));

const originalFetch = global.fetch;

function ShowZone() {
    return <span data-testid="zone">{useBusinessTimeZone()}</span>;
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useLanguage).mockReturnValue({ locale: 'en', t: getT('en') } as ReturnType<typeof useLanguage>);
    global.fetch = jest.fn();
});
afterAll(() => {
    global.fetch = originalFetch;
});

describe('BusinessTimeZoneProvider (ARCH-11)', () => {
    test('outside a cabinet the zone is Asia/Bishkek', () => {
        render(<ShowZone />);
        expect(screen.getByTestId('zone').textContent).toBe('Asia/Bishkek');
    });

    test.each([
        ['Asia/Almaty', 'Asia/Almaty'],
        ['Europe/Moscow', 'Europe/Moscow'],
        [null, 'Asia/Bishkek'],
        ['Not/AZone', 'Asia/Bishkek'],
    ])('the cabinet provides businesses.tz %j as %s', (tz, expected) => {
        render(<BusinessTimeZoneProvider timeZone={tz}><ShowZone /></BusinessTimeZoneProvider>);
        expect(screen.getByTestId('zone').textContent).toBe(expected);
    });
});

describe('BusinessTimeZoneSettingsForm', () => {
    test('offers zones with their offset and saves the chosen one', async () => {
        jest.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: async () => ({ ok: true, data: { tz: 'Asia/Almaty' } }),
        } as Response);
        render(<BusinessTimeZoneSettingsForm initial="Asia/Bishkek" />);

        const select = screen.getByLabelText('Business time zone') as HTMLSelectElement;
        expect(select.value).toBe('Asia/Bishkek');
        expect(screen.getByRole('option', { name: 'Asia/Bishkek (UTC+06:00)' })).toBeTruthy();
        expect(screen.getByRole('option', { name: 'Asia/Almaty (UTC+05:00)' })).toBeTruthy();
        const save = screen.getByRole('button', { name: 'Save time zone' });
        expect((save as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(select, { target: { value: 'Asia/Almaty' } });
        fireEvent.click(save);

        await waitFor(() => expect(screen.getByText('Time zone saved')).toBeTruthy());
        expect(global.fetch).toHaveBeenCalledWith('/api/dashboard/contact-settings', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ tz: 'Asia/Almaty' }),
        }));
    });

    test('keeps a saved zone outside the short list selectable', () => {
        render(<BusinessTimeZoneSettingsForm initial="Australia/Sydney" />);
        expect((screen.getByLabelText('Business time zone') as HTMLSelectElement).value).toBe('Australia/Sydney');
    });

    test('shows the server message when the zone is rejected', async () => {
        jest.mocked(global.fetch).mockResolvedValue({
            ok: false,
            json: async () => ({ ok: false, message: 'Unknown time zone' }),
        } as Response);
        render(<BusinessTimeZoneSettingsForm initial="Asia/Bishkek" />);
        fireEvent.change(screen.getByLabelText('Business time zone'), { target: { value: 'Europe/Moscow' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
        await waitFor(() => expect(screen.getByText('Unknown time zone')).toBeTruthy());
    });
});
