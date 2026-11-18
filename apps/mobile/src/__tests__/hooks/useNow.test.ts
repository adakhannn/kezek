import { act, renderHook } from '@testing-library/react-native';

import { useNow } from '../../hooks/useNow';

describe('useNow (FE-14)', () => {
    beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-18T10:00:00.000Z') }));
    afterEach(() => jest.useRealTimers());

    test('moves with the clock and on an explicit refresh', () => {
        const { result } = renderHook(() => useNow(60_000));
        expect(result.current.now.toISOString()).toBe('2026-11-18T10:00:00.000Z');

        act(() => {
            jest.advanceTimersByTime(60_000);
        });
        expect(result.current.now.toISOString()).toBe('2026-11-18T10:01:00.000Z');

        jest.setSystemTime(new Date('2026-11-18T10:01:30.000Z'));
        act(() => result.current.refresh());
        expect(result.current.now.toISOString()).toBe('2026-11-18T10:01:30.000Z');
    });

    test('stops ticking after unmount', () => {
        const { unmount } = renderHook(() => useNow(60_000));
        unmount();
        expect(jest.getTimerCount()).toBe(0);
    });
});
