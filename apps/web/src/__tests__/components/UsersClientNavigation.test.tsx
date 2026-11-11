/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import UsersClient from '@/app/admin/users/UsersClient';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };
jest.mock('next/navigation', () => ({
    useRouter: () => mockRouter,
    useSearchParams: () => new URLSearchParams(),
}));

const user = {
    id: 'user-one', full_name: 'Alice', email: 'alice@example.test', phone: null,
    last_sign_in_at: null, is_super: false, is_blocked: false,
};
const props = {
    initialUsers: [user], initialPage: 1, initialPerPage: 20, initialTotal: 1,
    initialSearch: '', initialStatus: 'all', stats: null,
};

describe('UsersClient server navigation', () => {
    beforeEach(() => { jest.useFakeTimers(); mockPush.mockClear(); });
    afterEach(() => { jest.useRealTimers(); });

    it('keeps a focused draft during a same-filter refresh and clears obsolete selection', () => {
        const { rerender } = render(<UsersClient {...props} />);
        fireEvent.click(screen.getAllByRole('checkbox')[1]);
        const input = screen.getByRole('textbox');
        input.focus();
        fireEvent.change(input, { target: { value: 'Al' } });

        rerender(<UsersClient {...props} initialUsers={[{ ...user, full_name: 'Alice Updated' }]} />);
        expect(screen.getByRole('textbox')).toBe(input);
        expect(document.activeElement).toBe(input);
        expect((input as HTMLInputElement).value).toBe('Al');
        expect(screen.getByText('Alice Updated')).toBeTruthy();
        expect(screen.queryByText('Выбрано: 1')).toBeNull();
        act(() => { jest.advanceTimersByTime(250); });
        expect(mockPush).toHaveBeenCalledWith('/admin/users?q=Al&status=all&page=1&perPage=20');
    });

    it('reflects committed filters and back navigation without remounting the search input', () => {
        const { rerender } = render(<UsersClient {...props} />);
        const input = screen.getByRole('textbox');
        input.focus();
        fireEvent.change(input, { target: { value: 'Alice' } });
        act(() => { jest.advanceTimersByTime(250); });
        mockPush.mockClear();

        rerender(<UsersClient {...props} initialSearch="Alice" initialStatus="active" initialPerPage={50} />);
        expect(screen.getByRole('textbox')).toBe(input);
        expect(document.activeElement).toBe(input);
        expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('active');
        expect((screen.getAllByRole('combobox')[1] as HTMLSelectElement).value).toBe('50');
        act(() => { jest.advanceTimersByTime(250); });
        expect(mockPush).not.toHaveBeenCalled();

        rerender(<UsersClient {...props} />);
        expect((input as HTMLInputElement).value).toBe('');
        expect(document.activeElement).toBe(input);
        act(() => { jest.advanceTimersByTime(250); });
        expect(mockPush).not.toHaveBeenCalled();
    });
});
