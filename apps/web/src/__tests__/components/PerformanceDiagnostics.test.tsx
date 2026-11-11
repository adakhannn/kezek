/** @jest-environment jsdom */
import { StrictMode, useState } from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';
import { useRenderCount } from '@/hooks/useRenderCount';
import { useWhyDidYouRender } from '@/hooks/useWhyDidYouRender';
import { getApiStats } from '@/lib/apiLogger';
import { logDebug, logWarn } from '@/lib/log';

jest.mock('@/lib/apiLogger', () => ({ getApiStats: jest.fn() }));
jest.mock('@/lib/log', () => ({ logDebug: jest.fn(), logWarn: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    jest.mocked(getApiStats).mockReturnValue({ totalCalls: 0, duplicateCalls: 0, callsByUrl: {} });
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('diagnostic hooks preserve hook order when diagnostics are disabled or enabled', () => {
    const { result, rerender } = renderHook(() => {
        const getCount = useRenderCount('Example');
        useWhyDidYouRender('Example', { value: 1 });
        const [state] = useState('following hook');
        return { getCount, state };
    });
    expect(result.current.getCount()).toBe(1);
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    rerender();
    expect(result.current.getCount()).toBe(0);
    expect(result.current.state).toBe('following hook');
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    rerender();
    expect(result.current.getCount()).toBe(2);
    expect(result.current.state).toBe('following hook');
});

test('render counter counts commits once under StrictMode without triggering extra renders', () => {
    const { result, rerender } = renderHook(() => useRenderCount('Example'), { wrapper: StrictMode });
    const getCount = result.current;
    expect(getCount()).toBe(1);
    for (let i = 0; i < 6; i++) rerender();
    expect(result.current).toBe(getCount);
    expect(getCount()).toBe(7);
    expect(logWarn).toHaveBeenCalledTimes(2);
    expect(logWarn).toHaveBeenLastCalledWith('RenderCount', expect.any(String), { componentName: 'Example', renderCount: 7 });
});

test('prop diagnostics observe reference changes that JSON omits and accept circular objects', () => {
    const cycle: { self?: unknown } = {};
    cycle.self = cycle;
    const firstCallback = () => undefined;
    const secondCallback = () => undefined;
    const { rerender } = renderHook(({ callback }) => useWhyDidYouRender('Example', { callback, cycle }), { initialProps: { callback: firstCallback } });
    expect(logDebug).not.toHaveBeenCalled();
    rerender({ callback: secondCallback });
    expect(logDebug).toHaveBeenCalledWith('WhyDidYouRender', 'Component props changed', {
        name: 'Example', changedProps: { callback: { from: firstCallback, to: secondCallback } },
    });
});

test('monitor starts polling only in development and cleans up on disable/unmount', () => {
    jest.useFakeTimers();
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    const { rerender, unmount } = render(<PerformanceMonitor />);
    expect(jest.getTimerCount()).toBe(0);
    expect(screen.queryByText('Performance Monitor')).toBeNull();
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    rerender(<PerformanceMonitor />);
    expect(jest.getTimerCount()).toBe(1);
    jest.mocked(getApiStats).mockReturnValue({ totalCalls: 1, duplicateCalls: 0, callsByUrl: {} });
    act(() => jest.advanceTimersByTime(2000));
    expect(screen.getByText('Performance Monitor')).toBeTruthy();
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    rerender(<PerformanceMonitor />);
    expect(jest.getTimerCount()).toBe(0);
    expect(screen.queryByText('Performance Monitor')).toBeNull();
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
    rerender(<PerformanceMonitor />);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
});
