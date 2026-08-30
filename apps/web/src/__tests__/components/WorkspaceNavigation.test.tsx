/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { WorkspaceSidebarShell } from '@/app/_components/workspace/WorkspaceNavigation';

const props = {
    title: 'Business workspace',
    subtitle: 'Business ID',
    items: [{ href: '/dashboard', label: 'Home', icon: <span aria-hidden="true">H</span> }],
    pathname: '/dashboard',
    isOpen: false,
    onOpen: jest.fn(),
    onClose: jest.fn(),
    openLabel: 'Open workspace navigation',
    closeLabel: 'Close workspace navigation',
    navTitle: 'Workspace sections',
    desktopStorageKey: 'test.workspace.sidebar.collapsed',
};

describe('WorkspaceSidebarShell', () => {
    beforeEach(() => {
        window.localStorage.clear();
        jest.clearAllMocks();
    });

    test('collapses and restores the desktop sidebar while persisting the preference', () => {
        render(<WorkspaceSidebarShell {...props} />);

        fireEvent.click(screen.getByTitle('Close workspace navigation'));
        expect(window.localStorage.getItem(props.desktopStorageKey)).toBe('true');
        expect(screen.queryByTitle('Close workspace navigation')).toBeNull();
        expect(screen.getByTitle('Open workspace navigation')).not.toBeNull();

        fireEvent.click(screen.getByTitle('Open workspace navigation'));
        expect(window.localStorage.getItem(props.desktopStorageKey)).toBe('false');
        expect(screen.getByTitle('Close workspace navigation')).not.toBeNull();
    });

    test('restores a collapsed preference on mount', () => {
        window.localStorage.setItem(props.desktopStorageKey, 'true');

        render(<WorkspaceSidebarShell {...props} />);

        expect(screen.getByTitle('Open workspace navigation')).not.toBeNull();
        expect(screen.queryByTitle('Close workspace navigation')).toBeNull();
    });

    test('opens the mobile navigation from the More action', () => {
        render(<WorkspaceSidebarShell {...props} moreLabel="More" />);

        fireEvent.click(screen.getByRole('button', { name: 'More' }));

        expect(props.onOpen).toHaveBeenCalledTimes(1);
    });

    test('closes the mobile sheet with Escape and locks background scroll while open', () => {
        render(<WorkspaceSidebarShell {...props} isOpen />);

        expect(document.body.style.overflow).toBe('hidden');
        fireEvent.keyDown(document, { key: 'Escape' });

        expect(props.onClose).toHaveBeenCalledTimes(1);
    });
});
