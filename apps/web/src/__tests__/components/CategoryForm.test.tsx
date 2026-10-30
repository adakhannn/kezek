/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';

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

    it('keeps a saved custom slug and starts unchanged when opening an edit form', () => {
        render(<CategoryForm mode="edit" categoryId="test-category" initial={{
            name_ru: 'LIVE TEST CATEGORY EDITED', slug: 'saved-custom-slug', is_active: false,
        }} />);
        expect((screen.getByLabelText('Адрес публичной страницы') as HTMLInputElement).value).toBe('saved-custom-slug');
        expect((screen.getByRole('button', { name: 'Сохранить изменения' }) as HTMLButtonElement).disabled).toBe(true);
        expect((screen.getByLabelText('Доступна для выбора') as HTMLInputElement).checked).toBe(false);
    });

    it('preserves edit slugs in StrictMode, supports clear-to-auto, and keeps manual overrides', () => {
        render(<StrictMode><CategoryForm mode="edit" categoryId="test-category" initial={{
            name_ru: 'Original renamed category', slug: 'saved-custom-slug', is_active: false,
        }} /></StrictMode>);
        const name = screen.getByLabelText('Название категории');
        const slug = screen.getByLabelText('Адрес публичной страницы') as HTMLInputElement;
        expect(slug.value).toBe('saved-custom-slug');
        fireEvent.change(name, { target: { value: 'C119 Өнөр Үңкүр' } });
        expect(slug.value).toBe('saved-custom-slug');
        fireEvent.change(slug, { target: { value: '' } });
        fireEvent.blur(slug);
        expect(slug.value).toBe('c119-onor-ungkur');
        fireEvent.change(slug, { target: { value: ' C119 Manual URL ' } });
        fireEvent.blur(slug);
        expect(slug.value).toBe('c119-manual-url');
        fireEvent.change(name, { target: { value: 'C119 SECOND LOCAL NAME' } });
        expect(slug.value).toBe('c119-manual-url');
    });

    it('still auto-generates create slugs and respects a manual create override', () => {
        render(<CategoryForm mode="create" />);
        const name = screen.getByLabelText('Название категории');
        const slug = screen.getByLabelText('Адрес публичной страницы') as HTMLInputElement;
        fireEvent.change(name, { target: { value: 'C119 Өнөр Үңкүр' } });
        expect(slug.value).toBe('c119-onor-ungkur');
        fireEvent.change(slug, { target: { value: 'manual-create-address' } });
        fireEvent.change(name, { target: { value: 'Changed name' } });
        expect(slug.value).toBe('manual-create-address');
    });
});
