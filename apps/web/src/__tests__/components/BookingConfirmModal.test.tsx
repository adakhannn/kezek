/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { BookingConfirmModal } from '@/app/b/[slug]/components/BookingConfirmModal';

describe('BookingConfirmModal', () => {
    const props = {
        open: true,
        busy: false,
        onClose: jest.fn(),
        onConfirm: jest.fn(),
        dayLabel: '12.10.2026',
        timeLabel: '09:00',
        branchName: 'Тестовый филиал',
        staffName: 'Тестовый сотрудник',
        serviceNames: ['Тестовая услуга'],
        t: (_key: string, fallback?: string) => fallback ?? '',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('shows the complete selection and creates a booking only on explicit confirmation', () => {
        render(<BookingConfirmModal {...props} />);

        const details = screen.getByRole('dialog').textContent ?? '';
        expect(details).toContain('12.10.2026, 09:00');
        expect(details).toContain('Тестовый филиал');
        expect(details).toContain('Тестовый сотрудник');
        expect(details).toContain('Тестовая услуга');
        expect(props.onConfirm).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Вернуться' }));
        expect(props.onClose).toHaveBeenCalledTimes(1);
        expect(props.onConfirm).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Подтвердить запись' }));
        expect(props.onConfirm).toHaveBeenCalledTimes(1);
    });

    test('prevents duplicate confirmation while creation is in progress', () => {
        render(<BookingConfirmModal {...props} busy />);

        expect((screen.getByRole('button', { name: 'Создаём запись…' }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: 'Вернуться' }) as HTMLButtonElement).disabled).toBe(true);
        expect(props.onConfirm).not.toHaveBeenCalled();
    });
});
