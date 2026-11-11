/** @jest-environment jsdom */
import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Toast } from '@/components/ui/Toast';
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const advance = (milliseconds: number) => act(() => { jest.advanceTimersByTime(milliseconds); });

test('callback identity updates do not restart the toast lifetime and the latest callback runs', () => {
    const first = jest.fn();
    const latest = jest.fn();
    const { rerender } = render(<Toast message="Saved" duration={1000} onClose={first} />);
    advance(600);
    rerender(<Toast message="Saved" duration={1000} onClose={latest} />);
    advance(400);
    expect(screen.getByRole('status').className).toContain('opacity-0');
    advance(300);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
});

test.each(['message', 'type'])('replacing %s starts a new visible lifetime and cancels the previous closing timer', change => {
    const oldClose = jest.fn();
    const nextClose = jest.fn();
    const { rerender } = render(<Toast message="Saved" type="info" duration={1000} onClose={oldClose} />);
    advance(1000);
    expect(screen.getByRole('status').className).toContain('opacity-0');
    advance(100);
    rerender(<Toast message={change === 'message' ? 'Updated' : 'Saved'} type={change === 'type' ? 'success' : 'info'} duration={1000} onClose={nextClose} />);
    expect(screen.getByRole('status').className).toContain('opacity-100');
    advance(300);
    expect(oldClose).not.toHaveBeenCalled();
    expect(nextClose).not.toHaveBeenCalled();
    advance(1000);
    expect(oldClose).not.toHaveBeenCalled();
    expect(nextClose).toHaveBeenCalledTimes(1);
});

test('manual close is one-shot even with repeated clicks and a pending auto-close', () => {
    const onClose = jest.fn();
    render(<StrictMode><Toast message="Saved" duration={1000} onClose={onClose} /></StrictMode>);
    const close = screen.getByRole('button', { name: 'Закрыть уведомление' });
    fireEvent.click(close);
    fireEvent.click(close);
    advance(5000);
    fireEvent.click(close);
    advance(300);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
});

test.each([0, 1000])('unmount cancels timers at elapsed %i', elapsed => {
    const onClose = jest.fn();
    const { unmount } = render(<Toast message="Saved" duration={1000} onClose={onClose} />);
    advance(elapsed);
    expect(jest.getTimerCount()).toBe(1);
    unmount();
    expect(jest.getTimerCount()).toBe(0);
    advance(5000);
    expect(onClose).not.toHaveBeenCalled();
});
