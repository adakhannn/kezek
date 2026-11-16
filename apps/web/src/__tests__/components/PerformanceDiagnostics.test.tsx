/** @jest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import { PerformanceMonitor } from '@/components/dev/PerformanceMonitor';
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
