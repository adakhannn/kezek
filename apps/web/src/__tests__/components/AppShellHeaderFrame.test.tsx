/** @jest-environment jsdom */

import { render } from '@testing-library/react';

import { AppShellHeaderFrame } from '@/app/_components/AppShellHeaderFrame';

const usePathname = jest.fn();

jest.mock('next/navigation', () => ({
    usePathname: () => usePathname(),
}));

describe('AppShellHeaderFrame', () => {
    it('scrolls the global header away on admin routes', () => {
        usePathname.mockReturnValue('/admin/categories');

        const { container } = render(<AppShellHeaderFrame>Header</AppShellHeaderFrame>);
        const header = container.querySelector('header');

        expect(header?.className).toContain('relative');
        expect(header?.className).not.toContain('sticky');
        expect(header?.className).not.toContain('top-0');
    });

    it('keeps the global header sticky on public routes', () => {
        usePathname.mockReturnValue('/map');

        const { container } = render(<AppShellHeaderFrame>Header</AppShellHeaderFrame>);
        const header = container.querySelector('header');

        expect(header?.className).toContain('sticky');
        expect(header?.className).toContain('top-0');
    });
});
