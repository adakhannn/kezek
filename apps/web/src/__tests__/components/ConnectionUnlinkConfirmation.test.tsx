/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { ConnectionUnlinkConfirmation } from '@/app/cabinet/components/ConnectionUnlinkConfirmation';

describe('connection unlink confirmation', () => {
    const defaults = { open: true, title: 'Отвязать Telegram?', message: 'Вход через Telegram будет недоступен.', confirmLabel: 'Отвязать', cancelLabel: 'Отмена', isLoading: false };
    test('requires explicit confirmation in a portal outside the profile form', () => {
        const onConfirm = jest.fn(); const onClose = jest.fn();
        render(<form><ConnectionUnlinkConfirmation {...defaults} onConfirm={onConfirm} onClose={onClose} /></form>);
        expect(screen.getByRole('dialog').closest('form')).toBeNull();
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onConfirm).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Отвязать' }));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    test('prevents repeat confirmation or dismissal while request is running', () => {
        const onConfirm = jest.fn(); const onClose = jest.fn();
        render(<ConnectionUnlinkConfirmation {...defaults} isLoading onConfirm={onConfirm} onClose={onClose} />);
        for (const button of screen.getAllByRole('button')) {
            expect((button as HTMLButtonElement).disabled).toBe(true);
            fireEvent.click(button);
        }
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onConfirm).not.toHaveBeenCalled();
        expect(onClose).not.toHaveBeenCalled();
    });
});
