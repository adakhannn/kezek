/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { WorkspaceSidebarShell } from './WorkspaceNavigation';

test('opens an opaque mobile navigation sheet above the page', () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    render(<WorkspaceSidebarShell title="Кабинет" subtitle="ID" items={[]} pathname="/staff" isOpen={false}
        onOpen={onOpen} onClose={onClose} openLabel="Открыть" closeLabel="Закрыть" navTitle="Разделы" moreLabel="Ещё" />);
    fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
    expect(onOpen).toHaveBeenCalled();
});

test('renders open sheet with a solid surface and modal semantics', () => {
    render(<WorkspaceSidebarShell title="Кабинет" subtitle="ID" items={[]} pathname="/staff" isOpen
        onOpen={() => undefined} onClose={() => undefined} openLabel="Открыть" closeLabel="Закрыть" navTitle="Разделы" moreLabel="Ещё" />);
    const dialog = screen.getByRole('dialog', { name: 'Разделы' });
    expect(dialog.className).toContain('z-[130]');
    const closeButton = dialog.querySelector('button[aria-label="Закрыть"]');
    expect(closeButton).toBeTruthy();
    const hasOpaquePanel = Array.from(dialog.querySelectorAll<HTMLElement>('[class]'))
        .some((element) => element.className.includes('bg-[var(--surface-card)]'));
    expect(hasOpaquePanel).toBe(true);
});
