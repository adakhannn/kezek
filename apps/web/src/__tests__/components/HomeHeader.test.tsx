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

    it('submits immediately without waiting for debounce', () => {
        render(<HomeHeader q="" cat="" categories={[]} totalResults={3} />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Low Fade' } });
        fireEvent.click(screen.getByRole('button', { name: 'Искать' }));

        expect(push).toHaveBeenCalledTimes(1);
        expect(push).toHaveBeenCalledWith('/?q=Low+Fade');
    });
});
