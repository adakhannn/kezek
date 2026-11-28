/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { BookingSteps } from '@/app/b/[slug]/components/BookingSteps';
import { BranchSelector } from '@/app/b/[slug]/components/BranchSelector';

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

    test('names the current step once in a compact line, without per-step hints', () => {
        const { container } = render(
            <BookingSteps
                stepsMeta={stepsMeta}
                step={1}
                totalSteps={5}
                canGoNext={false}
                goToStep={jest.fn()}
                stepIndicatorText="Шаг 1 из 5"
            />,
        );

        expect(screen.getByTestId('booking-step-indicator').textContent).toBe('Шаг 1 из 5 · Филиал');
        expect(container.textContent?.match(/Шаг 1 из 5/g)).toHaveLength(1);
        expect(container.textContent).not.toMatch(/Откроется|Сделайте|Сейчас|Дальше/);
    });
});

describe('BranchSelector without ratings', () => {
    test('shows no rating badge when a branch has no score, and only the selected branch gets a state badge', () => {
        const t = (key: string, fallback?: string) => fallback ?? key;
        render(
            <BranchSelector
                branches={[
                    { id: 'b1', name: 'First', rating_score: null },
                    { id: 'b2', name: 'Second', rating_score: 80 },
                ]}
                selectedBranchId="b2"
                onSelect={jest.fn()}
                formatBranchName={(name) => name}
                t={t}
            />,
        );

        expect(screen.queryByText('Нет рейтинга')).toBeNull();
        expect(screen.getByText('4.0')).toBeTruthy();
        expect(screen.queryByText('Доступно для выбора')).toBeNull();
        expect(screen.getByText('Выбрано для записи')).toBeTruthy();
        expect(screen.queryByText(/Шаг \d/)).toBeNull();
    });
});
