/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { ProfileNotice } from '@/app/cabinet/components/ProfileNotice';

describe('ProfileNotice', () => {
    test('renders an actionable error above the form in a floating layer', () => {
        const dismissError = jest.fn();
        render(
            <form>
                <ProfileNotice
                    message={null}
                    error="Этот Telegram аккаунт уже привязан к другому пользователю"
                    errorTitle="Не удалось выполнить действие"
                    closeLabel="Закрыть уведомление"
                    onDismissMessage={jest.fn()}
                    onDismissError={dismissError}
                />
            </form>,
        );

        const alert = screen.getByRole('alert');
        expect(alert.textContent).toContain('Этот Telegram аккаунт уже привязан');
        expect(alert.closest('form')).toBeNull();
        expect(alert.parentElement?.className).toContain('fixed');

        fireEvent.click(screen.getByRole('button', { name: 'Закрыть уведомление' }));
        expect(dismissError).toHaveBeenCalledTimes(1);
    });

    test('does not reserve form space when no notice is visible', () => {
        const { container } = render(
            <ProfileNotice
                message={null}
                error={null}
                errorTitle="Ошибка"
                closeLabel="Закрыть"
                onDismissMessage={jest.fn()}
                onDismissError={jest.fn()}
            />,
        );

        expect(container.innerHTML).toBe('');
        expect(screen.queryByRole('alert')).toBeNull();
    });
});
