/** @jest-environment node */
import { renderToStaticMarkup } from 'react-dom/server';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ProfileForm from '@/app/cabinet/components/ProfileForm';
import { supabase } from '@/lib/supabaseClient';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
jest.mock('@/app/cabinet/components/AccountDeletionPanel', () => ({ AccountDeletionPanel: () => null }));
jest.mock('@/app/cabinet/components/TelegramBotLink', () => ({ TelegramBotLink: () => null }));
jest.mock('@/app/cabinet/components/TelegramLinkWidget', () => ({ TelegramLinkWidget: () => null }));
jest.mock('@/app/cabinet/components/ConnectionUnlinkConfirmation', () => ({ ConnectionUnlinkConfirmation: () => null }));

const dictionaries = { ru, ky, en };
function selectLocale(locale: keyof typeof dictionaries) {
    (useLanguage as jest.Mock).mockReturnValue({
        locale,
        t: (key: string, fallback?: string) => dictionaries[locale][key] ?? fallback ?? key,
    });
}

beforeEach(() => { jest.clearAllMocks(); selectLocale('ru'); });

it.each(['ru', 'ky', 'en'] as const)('renders a loading boundary before the %s profile identity is known', (locale) => {
    selectLocale(locale);
    const html = renderToStaticMarkup(<ProfileForm />);
    expect(html).toContain(dictionaries[locale]['cabinet.profile.loading']);
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<button');
    expect(html).not.toContain(dictionaries[locale]['cabinet.profile.connections.connect']);
});

it('does not perform authentication or profile work during server rendering', () => {
    renderToStaticMarkup(<ProfileForm />);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
});
