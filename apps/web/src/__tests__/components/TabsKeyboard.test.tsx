/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

import { Tabs } from '@/components/ui/Tabs';
import ClientCabinet from '@/app/cabinet/ClientCabinet';

jest.mock('next/navigation', () => ({ usePathname: () => '/admin/analytics' }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key }) }));
jest.mock('@/app/cabinet/components/MyVisitPackagesBlock', () => ({ __esModule: true, default: () => null }));
jest.mock('@/app/cabinet/components/BookingCard', () => ({ __esModule: true, default: () => null }));

function Example() {
    const [value, setValue] = useState('first');
    return <Tabs value={value} onValueChange={setValue} items={[
        { key: 'first', label: 'First' }, { key: 'disabled', label: 'Disabled', disabled: true },
        { key: 'last', label: 'Last' },
    ]} />;
}

test('button tabs expose a single tab stop and arrow navigation wraps/skips disabled tabs', () => {
    render(<Example />);
    const first = screen.getByRole('tab', { name: 'First' });
    const last = screen.getByRole('tab', { name: 'Last' });
    expect(first.tabIndex).toBe(0);
    expect(last.tabIndex).toBe(-1);
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute('aria-selected')).toBe('true');
    expect(last.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
    fireEvent.keyDown(last, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(last);
});

test('Home/End move to the enabled extremes and unrelated keys do not change selection', () => {
    render(<Example />);
    const first = screen.getByRole('tab', { name: 'First' });
    const last = screen.getByRole('tab', { name: 'Last' });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Home' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(first.getAttribute('aria-selected')).toBe('true');
});

test('existing navigation links retain href/current-page semantics without command activation', () => {
    const change = jest.fn();
    render(<Tabs value="" onValueChange={change} items={[{ key: 'analytics', label: 'Analytics', href: '/admin/analytics' }]} />);
    const link = screen.getByRole('link', { name: 'Analytics' });
    expect(link.getAttribute('href')).toBe('/admin/analytics');
    expect(link.getAttribute('aria-current')).toBe('page');
    fireEvent.keyDown(link, { key: 'ArrowRight' });
    expect(change).not.toHaveBeenCalled();
});

test('client booking tabs point at their own rendered labelled panel', () => {
    render(<ClientCabinet userId="client" upcoming={[]} past={[]} />);
    let selected = screen.getByRole('tab', { selected: true });
    let panel = screen.getByRole('tabpanel');
    expect(selected.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id);
    selected.focus();
    fireEvent.keyDown(selected, { key: 'ArrowRight' });
    selected = screen.getByRole('tab', { selected: true });
    panel = screen.getByRole('tabpanel');
    expect(document.activeElement).toBe(selected);
    expect(selected.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(selected.id);
});
