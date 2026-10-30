/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

import StaffBookingsView from '@/app/staff/bookings/StaffBookingsView';

jest.mock('next/navigation', () => {
    const React = jest.requireActual<typeof import('react')>('react');
    const subscribe = (notify: () => void) => {
        window.addEventListener('popstate', notify);
        return () => window.removeEventListener('popstate', notify);
    };
    return {
        useSearchParams: () => new URLSearchParams(React.useSyncExternalStore(subscribe, () => window.location.search, () => '')),
        useRouter: () => ({ replace: (url: string) => {
            window.history.replaceState(window.history.state, '', url);
            window.dispatchEvent(new PopStateEvent('popstate'));
        } }),
    };
});

jest.mock('@/app/_components/i18n/LanguageProvider', () => ({
    useLanguage: () => ({ locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key }),
}));
jest.mock('@/app/staff/bookings/CreateBookingForm', () => ({ CreateBookingForm: () => <div>Create form fixture</div> }));

const row = (id: string) => ({
    id, status: 'confirmed', start_at: '2026-10-19T03:00:00Z', end_at: '2026-10-19T04:00:00Z',
    client_name: 'Fixture client', client_phone: null, services: null, branches: null, businesses: null,
});
const input: ComponentProps<typeof StaffBookingsView> = {
    bizId: 'biz', staffId: 'staff', branchId: 'branch', upcoming: [row('upcoming-row')], past: [row('past-row')],
    services: [], staff: [], branches: [],
};

beforeEach(() => window.history.replaceState({ __NA: true, fixtureNext: 'preserved' }, '', '/staff/bookings'));

const displayedHref = () => screen.getByRole('link', { name: 'Подробнее' }).getAttribute('href');
const selectPast = () => fireEvent.click(screen.getByRole('button', { name: /Прошедшие/ }));
const savedUrl = (saved: { bizId: string; staffId: string; tab: string }) =>
    '/staff/bookings?' + new URLSearchParams({ staffList: saved.tab, staffListBiz: saved.bizId, staffListStaff: saved.staffId });

test('restores the selected past list when returning to the same history entry', () => {
    const view = render(<StaffBookingsView {...input} />);
    selectPast();
    expect(displayedHref()).toBe('/booking/past-row');
    view.unmount();
    render(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/past-row');
});

test('defaults to upcoming when there is no saved read-only selection', () => {
    render(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/upcoming-row');
});

test.each([
    { bizId: 'another-biz', staffId: 'staff', tab: 'past' },
    { bizId: 'biz', staffId: 'another-staff', tab: 'past' },
    { bizId: 'biz', staffId: 'staff', tab: 'create' },
])('does not restore a foreign or non-read-only selection: %j', saved => {
    window.history.replaceState({}, '', savedUrl(saved));
    render(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/upcoming-row');
    expect(screen.queryByText('Create form fixture')).toBeNull();
});

test('responds to popstate while preserving the current staff scope', () => {
    render(<StaffBookingsView {...input} />);
    act(() => {
        window.history.replaceState({}, '', savedUrl({ bizId: 'biz', staffId: 'staff', tab: 'past' }));
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(displayedHref()).toBe('/booking/past-row');
});

test('preserves existing Next history metadata when selecting a list', () => {
    render(<StaffBookingsView {...input} />);
    selectPast();
    expect(window.history.state.__NA).toBe(true);
    expect(window.history.state.fixtureNext).toBe('preserved');
    expect(window.history.state).toEqual({ __NA: true, fixtureNext: 'preserved' });
    expect(window.location.search).toBe('?staffList=past&staffListBiz=biz&staffListStaff=staff');
});

test('does not persist the create form as a restored history view', () => {
    const view = render(<StaffBookingsView {...input} />);
    selectPast();
    fireEvent.click(screen.getByRole('button', { name: /Создать/ }));
    expect(screen.getByText('Create form fixture')).toBeTruthy();
    view.unmount();
    render(<StaffBookingsView {...input} />);
    expect(screen.queryByText('Create form fixture')).toBeNull();
    expect(displayedHref()).toBe('/booking/past-row');
});

test.each([{ bizId: 'another-biz' }, { staffId: 'another-staff' }])('ignores the saved list after a context change: %j', context => {
    const view = render(<StaffBookingsView {...input} />);
    selectPast();
    view.rerender(<StaffBookingsView {...input} {...context} />);
    expect(displayedHref()).toBe('/booking/upcoming-row');
});

test('remembers an explicit return to upcoming instead of reviving past', () => {
    const view = render(<StaffBookingsView {...input} />);
    selectPast();
    fireEvent.click(screen.getByRole('button', { name: /Предстоящие/ }));
    view.unmount();
    render(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/upcoming-row');
});

test('retains the mounted selection when a same-page refresh replaces Next metadata', () => {
    const view = render(<StaffBookingsView {...input} />);
    selectPast();
    window.history.replaceState({ __NA: true, fixtureNext: 'refreshed' }, '');
    view.rerender(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/past-row');
    expect(window.history.state.fixtureNext).toBe('refreshed');
    expect(window.location.search).toBe('?staffList=past&staffListBiz=biz&staffListStaff=staff');
    view.unmount();
    render(<StaffBookingsView {...input} />);
    expect(displayedHref()).toBe('/booking/past-row');
});

test('restores a different history entry rather than overriding it with the mounted selection', () => {
    render(<StaffBookingsView {...input} />);
    selectPast();
    act(() => {
        window.history.replaceState({ __NA: true }, '', '/staff/bookings');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(displayedHref()).toBe('/booking/upcoming-row');
});
