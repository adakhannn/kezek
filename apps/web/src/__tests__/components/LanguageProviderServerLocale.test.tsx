/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';

import { LanguageProvider, useLanguage } from '@/app/_components/i18n/LanguageProvider';

function LocaleProbe() {
    const { locale, t } = useLanguage();
    return <p>{locale}|{t('header.language')}</p>;
}

test.each([
    ['ru', 'Язык'],
    ['ky', 'Тил'],
    ['en', 'Language'],
] as const)('renders server-provided %s before client effects', (locale, label) => {
    const html = renderToStaticMarkup(<LanguageProvider initialLocale={locale}><LocaleProbe /></LanguageProvider>);
    expect(html).toBe(`<p>${locale}|${label}</p>`);
});

test('keeps the default for standalone consumers without a server locale', () => {
    const html = renderToStaticMarkup(<LanguageProvider><LocaleProbe /></LanguageProvider>);
    expect(html).toBe('<p>ru|Язык</p>');
});
