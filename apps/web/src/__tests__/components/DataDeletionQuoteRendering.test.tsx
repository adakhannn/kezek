/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import DataDeletionPage from '@/app/data-deletion/page';

test.each([
    'Перейдите в раздел "Профиль"',
    'В личном кабинете найдите раздел "Профиль" или "Настройки аккаунта".',
    'Найдите опцию "Удалить аккаунт"',
    'В настройках профиля найдите раздел "Опасная зона" или "Удаление аккаунта".',
])('preserves the existing quoted instruction: %s', (text) => {
    render(<DataDeletionPage />);
    expect(screen.getByText(text, { exact: true })).toBeTruthy();
});
