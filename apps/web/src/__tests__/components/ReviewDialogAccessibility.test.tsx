/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ReviewDialog from '@/app/cabinet/components/ReviewDialog';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
const existing = { id: 'fixture-review', rating: 3, comment: 'Stored review fixture' };
const dictionaries = { ru, en, ky };
let originalFetch: typeof fetch;

function Harness() {
    const [open, setOpen] = useState(false);
    return <>
        <button onClick={() => setOpen(true)}>Edit fixture review</button>
        <button>Background fixture action</button>
        {open ? <ReviewDialog bookingId="fixture-booking" existingReview={existing} onClose={() => setOpen(false)} /> : null}
    </>;
}

describe.each(['ru', 'en', 'ky'] as const)('ReviewDialog accessibility %s', locale => {
    const dictionary = dictionaries[locale];
    beforeEach(() => {
        jest.clearAllMocks();
        originalFetch = global.fetch;
        global.fetch = jest.fn();
        (useLanguage as jest.Mock).mockReturnValue({ locale, t: (key: string, fallback?: string) => dictionary[key] ?? fallback ?? key });
        jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1; });
    });
    afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

    it('names the modal and both visible fields, preserving stored review', () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole('button', { name: 'Edit fixture review' }));
        expect(screen.getByRole('dialog', { name: dictionary['cabinet.review.edit'] }).getAttribute('aria-modal')).toBe('true');
        expect((screen.getByRole('combobox', { name: dictionary['cabinet.review.rating'], exact: true }) as HTMLSelectElement).value).toBe('3');
        expect((screen.getByRole('textbox', { name: new RegExp(dictionary['cabinet.review.comment']) }) as HTMLTextAreaElement).value).toBe(existing.comment);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('contains keyboard focus and restores the trigger after Escape without sending', () => {
        render(<Harness />);
        const trigger = screen.getByRole('button', { name: 'Edit fixture review' });
        trigger.focus(); fireEvent.click(trigger);
        const close = screen.getByRole('button', { name: dictionary['common.closeDialog'] });
        expect(document.activeElement).toBe(close);
        fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
        expect(document.activeElement).toBe(screen.getByRole('button', { name: dictionary['cabinet.review.update'] }));
        fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
        expect(document.activeElement).toBe(close);
        fireEvent.keyDown(close, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('cancels a local comment draft without calling the review endpoint', async () => {
        render(<Harness />);
        const trigger = screen.getByRole('button', { name: 'Edit fixture review' });
        trigger.focus(); fireEvent.click(trigger);
        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'LOCAL DRAFT ONLY' } });
        await act(async () => fireEvent.click(screen.getByRole('button', { name: dictionary['cabinet.review.cancel'] })));
        expect(screen.queryByRole('textbox')).toBeNull();
        expect(document.activeElement).toBe(trigger);
        expect(global.fetch).not.toHaveBeenCalled();
    });
});
