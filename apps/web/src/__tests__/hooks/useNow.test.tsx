/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useNow } from '@/hooks/useNow';

describe('useNow (FE-14)', () => {
    beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-18T10:00:00.000Z') }));
    afterEach(() => jest.useRealTimers());

    test('moves with the clock while the screen stays open', () => {
        const { result } = renderHook(() => useNow(60_000));
        expect(result.current.toISOString()).toBe('2026-11-18T10:00:00.000Z');

        act(() => {
            jest.advanceTimersByTime(60_000);
        });
        expect(result.current.toISOString()).toBe('2026-11-18T10:01:00.000Z');
    });

    test('stops ticking after unmount', () => {
        const { unmount } = renderHook(() => useNow(60_000));
        unmount();
        expect(jest.getTimerCount()).toBe(0);
    });
});
