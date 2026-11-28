/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import DataDeletionPage from '@/app/data-deletion/page';

test.each([
    'Найдите раздел «Удаление аккаунта»',
    'На сайте: «Личный кабинет» → «Профиль». В приложении: «Профиль».',
    'Введите слово УДАЛИТЬ и нажмите «Запросить удаление аккаунта». Удаление будет запланировано через 7 дней.',
])('renders the quoted instruction as written: %s', async (text) => {
    render(await DataDeletionPage());
    expect(screen.getByText(text, { exact: true })).toBeTruthy();
});
