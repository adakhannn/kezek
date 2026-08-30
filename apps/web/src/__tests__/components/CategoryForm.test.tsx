/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { CategoryForm } from '@/components/admin/categories/CategoryForm';

const push = jest.fn();
const refresh = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push, refresh }),
}));

describe('CategoryForm', () => {
    beforeEach(() => {
        push.mockReset();
        refresh.mockReset();
    });

    it('generates a readable public address from the category name', () => {
        render(<CategoryForm mode="create" />);

        fireEvent.change(screen.getByLabelText('Название категории'), {
            target: { value: 'Женская парикмахерская' },
        });

        expect(screen.getByText('kezek.kg/b/zhenskaya-parikmaherskaya')).toBeTruthy();
        expect(screen.getByLabelText('Доступна для выбора')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Отмена' }).getAttribute('href')).toBe('/admin/categories');
        expect(screen.getByRole('button', { name: 'Создать категорию' })).toBeTruthy();
    });

    it('allows the availability state to be changed before submission', () => {
        render(<CategoryForm mode="create" />);

        const availability = screen.getByLabelText('Доступна для выбора') as HTMLInputElement;
        expect(availability.checked).toBe(true);

        fireEvent.click(availability);

        expect(availability.checked).toBe(false);
    });
});
