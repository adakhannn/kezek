/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { BookingSteps } from '@/app/b/[slug]/components/BookingSteps';

describe('BookingSteps', () => {
    const stepsMeta = [
        { id: 1 as const, label: 'Филиал' },
        { id: 2 as const, label: 'День' },
        { id: 3 as const, label: 'Сотрудник' },
        { id: 4 as const, label: 'Услуга' },
        { id: 5 as const, label: 'Время' },
    ];

    test('allows returning to a completed step but keeps current and upcoming steps disabled', () => {
        const goToStep = jest.fn();

        render(
            <BookingSteps
                stepsMeta={stepsMeta}
                step={4}
                totalSteps={5}
                canGoNext
                goToStep={goToStep}
                stepIndicatorText="Шаг 4 из 5"
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Вернуться к шагу 2: День' }));
        expect(goToStep).toHaveBeenCalledWith(2);

        expect((screen.getByRole('button', { name: /Услуга/ }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByRole('button', { name: /Время/ }) as HTMLButtonElement).disabled).toBe(true);
    });
});
