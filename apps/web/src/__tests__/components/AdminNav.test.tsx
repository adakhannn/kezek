/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { AdminNav } from '@/app/admin/_components/AdminNav';

let mockPathname = '/admin';

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
}));

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({
        t: (key: string, fallback?: string) => ({
            'admin.nav.sections': 'Разделы',
        }[key] ?? fallback ?? key),
    }),
}));

describe('AdminNav', () => {
    beforeEach(() => { mockPathname = '/admin'; });

    it('resets the open section menu on navigation, including a return to the previous page', () => {
        const { rerender } = render(<AdminNav />);
        fireEvent.click(screen.getByRole('button', { name: /Разделы/, expanded: false }));
        mockPathname = '/admin/users';
        rerender(<AdminNav />);
        expect(document.getElementById('admin-tablet-menu')).toBeNull();
        mockPathname = '/admin';
        rerender(<AdminNav />);
        expect(document.getElementById('admin-tablet-menu')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Разделы/, expanded: false }));
        fireEvent.mouseDown(document.body);
        expect(document.getElementById('admin-tablet-menu')).toBeNull();
    });

    it('provides a collapsible navigation menu below the desktop breakpoint', () => {
        render(<AdminNav />);

        const button = screen.getByRole('button', { name: /Разделы/, expanded: false });
        expect(button.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(button);

        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(document.getElementById('admin-tablet-menu')).not.toBeNull();
        expect(screen.getAllByRole('link', { name: 'Главная' }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: 'Категории' }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: 'Заявки бизнеса' }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole('link', { name: 'Заявки доступа' }).length).toBeGreaterThan(0);
    });
});
