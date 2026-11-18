/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import AdminPageError from '@/app/admin/error';
import CabinetPageError from '@/app/cabinet/error';
import AppPageError from '@/app/error';
import { reportErrorToMonitoring } from '@/lib/errorMonitoring';

jest.mock('@/lib/errorMonitoring', () => ({ reportErrorToMonitoring: jest.fn() }));
const mockLanguage = { locale: 'ru', t: (_key: string, fallback?: string) => fallback ?? _key };
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: () => mockLanguage }));

// FE-09: one root boundary replaced the whole application, header and menus included, on any
// page crash. Section error pages keep the shell and retry only the crashed section.
describe('section error pages', () => {
    const reload = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(window, 'location', { configurable: true, value: { reload, href: 'https://kezek.vercel.app/cabinet?x=1' } });
    });

    test.each([
        ['AppPage', AppPageError],
        ['AdminPage', AdminPageError],
        ['CabinetPage', CabinetPageError],
    ])('%s reports the crash once, with the server digest, and retries only the section', (scope, Page) => {
        const reset = jest.fn();
        const error = Object.assign(new Error('Render failed'), { digest: '12345' });

        render(<Page error={error} reset={reset} />);

        expect(reportErrorToMonitoring).toHaveBeenCalledTimes(1);
        expect(reportErrorToMonitoring).toHaveBeenCalledWith(expect.objectContaining({
            scope,
            error: expect.objectContaining({ message: 'Render failed' }),
            extra: { digest: '12345' },
        }));
        fireEvent.click(screen.getAllByRole('button')[0]);
        expect(reset).toHaveBeenCalledTimes(1);
        expect(reload).not.toHaveBeenCalled();
    });

    test('a stale chunk after a deploy reloads the document instead', () => {
        const reset = jest.fn();
        const error = Object.assign(new Error('Loading chunk 123 failed'), { name: 'ChunkLoadError' });

        render(<AppPageError error={error} reset={reset} />);
        fireEvent.click(screen.getAllByRole('button')[0]);

        expect(reload).toHaveBeenCalledTimes(1);
        expect(reset).not.toHaveBeenCalled();
    });
});
