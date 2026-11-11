/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';

import { StaffOnboarding } from '@/app/staff/components/StaffOnboarding';

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
const key = 'staff_onboarding_dismissed_v1';
beforeEach(() => window.localStorage.clear());
afterEach(() => jest.restoreAllMocks());

it('shows the guide when no dismissal has been saved', () => {
    render(<StaffOnboarding />);
    expect(screen.getByText('Кратко о разделах')).toBeTruthy();
});

it('keeps a persisted dismissal hidden without changing storage', () => {
    window.localStorage.setItem(key, '1');
    const write = jest.spyOn(Storage.prototype, 'setItem');
    render(<StaffOnboarding />);
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
    expect(write).not.toHaveBeenCalled();
});

it('persists dismissal and keeps the guide hidden after remount', () => {
    const first = render(<StaffOnboarding />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
    expect(window.localStorage.getItem(key)).toBe('1');
    first.unmount();
    render(<StaffOnboarding />);
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
});

it('stays hidden if the persisted state cannot be read', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<StaffOnboarding />);
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
});

it('dismisses for the mounted session even if persistence fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const view = render(<StaffOnboarding />);
    fireEvent.click(screen.getByRole('button', { name: 'Понятно' }));
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
    view.rerender(<StaffOnboarding />);
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
});

it('synchronizes dismissal and reset from another tab', () => {
    render(<StaffOnboarding />);
    window.localStorage.setItem(key, '1');
    act(() => window.dispatchEvent(new StorageEvent('storage', { key, newValue: '1' })));
    expect(screen.queryByText('Кратко о разделах')).toBeNull();
    window.localStorage.removeItem(key);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key, newValue: null })));
    expect(screen.getByText('Кратко о разделах')).toBeTruthy();
});

it('hydrates hidden server markup before showing the unread guide', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onRecoverableError = jest.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
        await act(async () => { root = hydrateRoot(container, <StaffOnboarding />, { onRecoverableError }); });
        expect(container.textContent).toContain('Кратко о разделах');
        expect(onRecoverableError).not.toHaveBeenCalled();
    } finally {
        await act(async () => root?.unmount());
        container.remove();
    }
});
