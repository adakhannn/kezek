/** @jest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react';

import { MobileSidebar } from '@/app/dashboard/components/MobileSidebar';
import { StaffMobileSidebar } from '@/app/staff/components/StaffMobileSidebar';

let mockPathname = '/';
const mockBusinessMount = jest.fn();
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('@/app/dashboard/components/BusinessSwitcher', () => ({
    BusinessSwitcher: function BusinessSwitcher() {
        const { useEffect } = jest.requireActual<typeof import('react')>('react');
        useEffect(() => { mockBusinessMount(); }, []);
        return null;
    },
}));

describe.each([
    { role: 'owner', path: '/dashboard', sidebar: <MobileSidebar bizId="business-one" /> },
    { role: 'staff', path: '/staff', sidebar: <StaffMobileSidebar staffId="staff-one" /> },
])('$role mobile sidebar', ({ path, sidebar }) => {
    it('closes on route changes and releases the background scroll lock', () => {
        mockBusinessMount.mockClear();
        mockPathname = path;
        const { rerender } = render(<>{sidebar}</>);
        fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
        expect(document.body.style.overflow).toBe('hidden');
        const mountsBeforeNavigation = mockBusinessMount.mock.calls.length;

        mockPathname = `${path}/bookings`;
        // A fresh element emulates the rerender caused by the router hook.
        rerender(<>{sidebar.type === MobileSidebar ? <MobileSidebar bizId="business-one" /> : <StaffMobileSidebar staffId="staff-one" />}</>);
        expect(document.body.style.overflow).not.toBe('hidden');
        mockPathname = path;
        rerender(<>{sidebar.type === MobileSidebar ? <MobileSidebar bizId="business-one" /> : <StaffMobileSidebar staffId="staff-one" />}</>);
        expect(document.body.style.overflow).not.toBe('hidden');
        expect(mockBusinessMount).toHaveBeenCalledTimes(mountsBeforeNavigation);
        fireEvent.click(screen.getByRole('button', { name: 'Ещё' }));
        expect(document.body.style.overflow).toBe('hidden');
    });
});
