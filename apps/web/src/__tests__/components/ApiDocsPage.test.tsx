/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import ApiDocsPage from '@/app/api-docs/page';
import { swaggerSpec } from '@/lib/swagger';

jest.mock('next/dynamic', () => () => function SwaggerConsumer(props: { spec: Record<string, unknown>; supportedSubmitMethods: string[] }) {
    return <div data-testid="swagger" data-read-only={props.supportedSubmitMethods.length === 0}>{String(props.spec.openapi)}</div>;
});
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => ({ t: (_key: string, fallback: string) => fallback }) }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));

const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

test('passes a root OpenAPI document to the read-only Swagger consumer', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => swaggerSpec });
    render(<ApiDocsPage />);
    const consumer = await screen.findByTestId('swagger');
    expect(consumer.textContent).toBe('3.0.3');
    expect(consumer.getAttribute('data-read-only')).toBe('true');
    expect(global.fetch).toHaveBeenCalledWith('/api/swagger.json', { signal: expect.any(AbortSignal) });
});

test.each([
    ['HTTP error containing a spec', false, 503, swaggerSpec],
    ['error envelope', true, 200, { ok: false, error: 'internal' }],
    ['old success envelope', true, 200, { ok: true, data: swaggerSpec }],
    ['empty catalog', true, 200, { openapi: '3.0.3', info: { title: 'Empty', version: '1' }, paths: {} }],
    ['invalid paths', true, 200, { openapi: '3.0.3', info: { title: 'Wrong', version: '1' }, paths: [] }],
])('rejects %s rather than rendering it as OpenAPI', async (_label, ok, status, payload) => {
    global.fetch = jest.fn().mockResolvedValue({ ok, status, json: async () => payload });
    render(<ApiDocsPage />);
    expect(await screen.findByText('Не удалось загрузить документацию')).toBeTruthy();
    expect(screen.queryByTestId('swagger')).toBeNull();
});

test('shows an error for invalid JSON', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => { throw new SyntaxError('invalid JSON'); } });
    render(<ApiDocsPage />);
    expect(await screen.findByText('Не удалось загрузить документацию')).toBeTruthy();
});

test('aborts the document request on unmount', async () => {
    let signal: AbortSignal | undefined;
    global.fetch = jest.fn((_input, options) => {
        signal = options?.signal as AbortSignal;
        return new Promise(() => undefined);
    });
    const { unmount } = render(<ApiDocsPage />);
    await waitFor(() => expect(signal).toBeDefined());
    unmount();
    expect(signal?.aborted).toBe(true);
});
