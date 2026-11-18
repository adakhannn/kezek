/** @jest-environment jsdom */

import { act, fireEvent, render, screen } from '@testing-library/react';

import { HomeHeader } from '@/app/_components/HomeClientComponents';

const replace = jest.fn();
const push = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({ replace, push }),
}));

describe('HomeHeader', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        replace.mockReset();
        push.mockReset();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('updates discovery once after the debounce interval and preserves the category', () => {
        render(<HomeHeader q="" cat="barbershop" categories={['barbershop']} totalResults={3} />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Man' } });

        act(() => {
            jest.advanceTimersByTime(499);
        });
        expect(replace).not.toHaveBeenCalled();

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(replace).toHaveBeenCalledTimes(1);
        expect(replace).toHaveBeenCalledWith('/?q=Man&cat=barbershop');
    });

    it('keeps characters typed while the URL catches up with the debounced query (FE-11)', () => {
        const props = { cat: '', categories: [], totalResults: 3 };
        const { rerender } = render(<HomeHeader q="" {...props} />);
        const input = screen.getByRole('textbox') as HTMLInputElement;

        fireEvent.change(input, { target: { value: 'Man' } });
        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(replace).toHaveBeenCalledWith('/?q=Man');

        // The user keeps typing before the server answers with q=Man.
        fireEvent.change(input, { target: { value: 'Manicure' } });
        rerender(<HomeHeader q="Man" {...props} />);
        expect(input.value).toBe('Manicure');

        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(replace).toHaveBeenLastCalledWith('/?q=Manicure');
    });

    it('takes a query that changed outside the field, e.g. after going back', () => {
        const props = { cat: '', categories: [], totalResults: 3 };
        const { rerender } = render(<HomeHeader q="Man" {...props} />);

        rerender(<HomeHeader q="Barber" {...props} />);

        expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('Barber');
    });

    it('submits immediately without waiting for debounce', () => {
        render(<HomeHeader q="" cat="" categories={[]} totalResults={3} />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Low Fade' } });
        fireEvent.click(screen.getByRole('button', { name: 'Найти' }));

        expect(push).toHaveBeenCalledTimes(1);
        expect(push).toHaveBeenCalledWith('/?q=Low+Fade');
    });
});
