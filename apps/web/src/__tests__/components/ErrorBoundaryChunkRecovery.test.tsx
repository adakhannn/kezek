/** @jest-environment jsdom */
import { ErrorBoundary } from '@/components/ErrorBoundary';

jest.mock('@/lib/errorMonitoring', () => ({ reportErrorToMonitoring: jest.fn() }));
jest.mock('@/components/ErrorDisplay', () => ({ ErrorDisplay: () => null }));

const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')!;
const reload = jest.fn();

beforeEach(() => {
    reload.mockClear();
    Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
});
afterAll(() => Object.defineProperty(window, 'location', locationDescriptor));

test.each([
    new Error('Failed to load chunk /_next/static/chunks/a3ede8c22273d7ed.js from module 168303'),
    Object.assign(new Error('Loading chunk 123 failed.'), { name: 'ChunkLoadError' }),
    new Error('Loading chunk 123 failed.\n(error: https://example.test/_next/static/chunks/123.js)'),
    new Error('Loading CSS chunk 45 failed.'),
])('user retry reloads the document for a cached chunk failure: %s', error => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, error };
    const reset = jest.spyOn(boundary, 'setState').mockImplementation(() => {});
    boundary.handleReset();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reset).not.toHaveBeenCalled();
});

test.each([
    new Error('Application failure'),
    new Error('Failed to fetch'),
    new Error('Failed to load chunk of business records'),
    new Error('Failed to load chunk /private/report.js from module 12'),
    new Error('A chunk failed while saving data'),
    null,
])('ordinary failure still uses in-place boundary reset without reload: %s', error => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { hasError: true, error };
    const reset = jest.spyOn(boundary, 'setState').mockImplementation(() => {});
    boundary.handleReset();
    expect(reload).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledWith({ hasError: false, error: null });
});

test('recognizing an error does not automatically reload before user retry', () => {
    const error = new Error('Failed to load chunk /_next/static/chunks/a3ede8c22273d7ed.js from module 168303');
    expect(ErrorBoundary.getDerivedStateFromError(error)).toEqual({ hasError: true, error });
    expect(reload).not.toHaveBeenCalled();
});
