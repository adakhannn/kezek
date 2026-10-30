/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { notFound, redirect } from 'next/navigation';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { reportErrorToMonitoring } from '@/lib/errorMonitoring';

jest.mock('@/lib/errorMonitoring', () => ({ reportErrorToMonitoring:jest.fn() }));
jest.mock('@/components/ErrorDisplay', () => ({ ErrorDisplay:({error}:{error:Error}) => <div data-testid="application-error">{error.message}</div> }));

function thrownBy(action: () => never): Error {
    try { action(); } catch (error) { return error as Error; }
    throw new Error('Expected framework signal');
}

test.each([
    ['notFound', () => notFound()],
    ['redirect', () => redirect('/auth/sign-in')],
] as const)('lets Next handle its %s control signal instead of showing an application failure', (_name, action) => {
    const error = thrownBy(action);
    expect(() => ErrorBoundary.getDerivedStateFromError(error)).toThrow(error);
});

test('lets Next handle a framework signal nested in an error cause', () => {
    const signal = thrownBy(() => notFound());
    const error = new Error('Wrapped', { cause:signal });
    expect(() => ErrorBoundary.getDerivedStateFromError(error)).toThrow(signal);
});

test('keeps an ordinary application failure in the existing boundary', () => {
    const error = new Error('Application failure');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ hasError:true, error });
});

test('preserves normal rendering and application error monitoring/fallback', () => {
    const output = render(<ErrorBoundary><p>Healthy content</p></ErrorBoundary>);
    expect(screen.getByText('Healthy content')).toBeTruthy();
    function Broken(): never { throw new Error('Application failure'); }
    const logger = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
        output.rerender(<ErrorBoundary><Broken /></ErrorBoundary>);
        expect(screen.getByTestId('application-error').textContent).toBe('Application failure');
        expect(reportErrorToMonitoring).toHaveBeenCalledWith(expect.objectContaining({ scope:'ErrorBoundary' }));
    } finally { logger.mockRestore(); }
});

test('preserves a caller-provided fallback and safely reports a failed onError callback', () => {
    const error = new Error('Application failure');
    const boundary = new ErrorBoundary({ children:null, fallback:<p>Custom fallback</p>, onError:() => {throw new Error('Callback failed');} });
    boundary.state = ErrorBoundary.getDerivedStateFromError(error);
    render(boundary.render());
    expect(screen.getByText('Custom fallback')).toBeTruthy();
    jest.mocked(reportErrorToMonitoring).mockClear();
    boundary.componentDidCatch(error, { componentStack:'test stack' });
    expect(reportErrorToMonitoring).toHaveBeenCalledTimes(2);
});
