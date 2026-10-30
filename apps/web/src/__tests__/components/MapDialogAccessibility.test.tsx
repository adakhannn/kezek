/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import MapDialog from '@/app/cabinet/components/MapDialog';
import { loadYandexMaps } from '@/lib/yamaps';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/yamaps', () => ({ loadYandexMaps: jest.fn(() => new Promise(() => {})) }));

function Harness() {
    const [open, setOpen] = useState(false);
    return <>
        <button onClick={() => setOpen(true)}>Open map</button>
        <button>Background action</button>
        <MapDialog open={open} onClose={() => setOpen(false)} lat={40.5} lon={72.8}
            title="Fixture branch" address="Fixture address" />
    </>;
}

describe.each(['ru', 'en', 'ky'] as const)('MapDialog accessibility in %s', locale => {
    const dictionary = { ru, en, ky }[locale];
    beforeEach(() => {
        jest.clearAllMocks();
        (useLanguage as jest.Mock).mockReturnValue({
            locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key,
        });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    });
    afterEach(() => { jest.restoreAllMocks(); });

    it('does not load or expose a map while closed', () => {
        render(<Harness />);
        expect(screen.queryByText('Fixture branch')).toBeNull();
        expect(loadYandexMaps).not.toHaveBeenCalled();
    });

    it('names the modal and its description, with a localized close control', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Open map' }));
        const dialog = screen.getByRole('dialog', { name: 'Fixture branch' });
        expect(dialog.getAttribute('aria-modal')).toBe('true');
        expect(document.getElementById(dialog.getAttribute('aria-describedby')!)?.textContent).toBe('Fixture address');
        expect(screen.getByRole('button', { name: dictionary['common.closeDialog'] })).toBeTruthy();
    });

    it('contains keyboard focus, dismisses on Escape, and restores its trigger', () => {
        render(<Harness />);
        const trigger = screen.getByRole('button', { name: 'Open map' });
        trigger.focus();
        fireEvent.click(trigger);
        const close = screen.getByRole('button', { name: dictionary['common.closeDialog'] });
        expect(document.activeElement).toBe(close);
        for (const shiftKey of [false, true]) {
            const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
            close.dispatchEvent(event);
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(close);
        }
        fireEvent.keyDown(close, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
    });
});
