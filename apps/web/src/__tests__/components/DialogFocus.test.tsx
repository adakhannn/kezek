/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Dialog } from '@/components/ui/Dialog';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'en', t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
        callback(0);
        return 0;
    });
});

afterEach(() => jest.restoreAllMocks());

// The parent owns the form state and passes an inline onClose, like GuestBookingModal.
function GuestForm({ onClose }: { onClose: (name: string) => void }) {
    const [name, setName] = useState('');
    return (
        <Dialog open title="Guest booking" onClose={() => onClose(name)}>
            <input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <input aria-label="Phone" />
        </Dialog>
    );
}

describe('Dialog focus (FE-01)', () => {
    it('keeps focus in the field being typed into across parent re-renders', () => {
        render(<GuestForm onClose={jest.fn()} />);
        const name = screen.getByLabelText('Name') as HTMLInputElement;
        name.focus();
        for (const value of ['A', 'Ai', 'Aid', 'Aida']) {
            fireEvent.change(name, { target: { value } });
            expect(document.activeElement).toBe(name);
        }
        expect(name.value).toBe('Aida');
    });

    it('Escape calls the latest onClose after re-renders', () => {
        const onClose = jest.fn();
        render(<GuestForm onClose={onClose} />);
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bek' } });
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledWith('Bek');
    });

    it('moves focus into the dialog once when it opens and returns it to the opener', () => {
        function Opener() {
            const [open, setOpen] = useState(false);
            const [note, setNote] = useState('');
            return (
                <>
                    <button type="button" onClick={() => setOpen(true)}>Open</button>
                    <Dialog open={open} title="Details" onClose={() => setOpen(false)}>
                        <input aria-label="Note" value={note} onChange={(event) => setNote(event.target.value)} />
                    </Dialog>
                </>
            );
        }
        render(<Opener />);
        const opener = screen.getByRole('button', { name: 'Open' });
        opener.focus();
        fireEvent.click(opener);
        const close = screen.getByRole('button', { name: 'Закрыть окно' });
        expect(document.activeElement).toBe(close);
        const note = screen.getByLabelText('Note');
        note.focus();
        fireEvent.change(note, { target: { value: 'x' } });
        expect(document.activeElement).toBe(note);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(document.activeElement).toBe(opener);
    });
});
