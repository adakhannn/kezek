/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

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

type Locale = 'ru' | 'en' | 'ky';
const dictionaries = { ru, en, ky };
const initialName = 'LIVE TEST CLIENT FIXTURE';
let locale: Locale;
let mockProfileRead: jest.Mock;
let originalFetch: typeof fetch;

function selectLocale(next: Locale) {
    locale = next;
    (useLanguage as jest.Mock).mockReturnValue({
        locale,
        t: (key: string, fallback?: string) => dictionaries[locale][key] ?? fallback ?? key,
    });
}
function text(key: string) { return dictionaries[locale][key]; }

beforeEach(() => {
    jest.clearAllMocks();
    selectLocale('ru');
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, data: [] }) })) as jest.Mock;
    mockProfileRead = jest.fn(async () => ({ data: { full_name: initialName, phone: null, whatsapp_phone: null, notify_email: false }, error: null }));
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: { id: 'fixture-client', identities: [{ provider: 'google' }] } } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mockProfileRead }) }) });
});
afterEach(() => { global.fetch = originalFetch; });

async function mount() {
    const view = render(<ProfileForm />);
    await screen.findByDisplayValue(initialName);
    await waitFor(() => expect(screen.queryByText(text('common.loading'))).toBeNull());
    return view;
}

it('loads a clean profile once without submitting', async () => {
    await mount();
    expect(mockProfileRead).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith('/api/profile/notification-emails');
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('blocks invalid phone and explicitly resets the local draft', async () => {
    await mount();
    fireEvent.change(screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }), { target: { value: 'INVALID' } });
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }).getAttribute('aria-invalid')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: text('common.reset'), exact: true }));
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('button', { name: text('common.reset'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect(mockProfileRead).toHaveBeenCalledTimes(1);
});

it('does not reload on an ordinary same-language rerender', async () => {
    const view = await mount();
    await act(async () => view.rerender(<ProfileForm />));
    expect(mockProfileRead).toHaveBeenCalledTimes(1);
});

it('loads stored profile again for a new form instance', async () => {
    const first = await mount();
    first.unmount();
    await mount();
    expect(mockProfileRead).toHaveBeenCalledTimes(2);
    expect(screen.getByDisplayValue(initialName)).toBeTruthy();
});

it.each([['ru', 'en'], ['en', 'ky'], ['ky', 'ru']] as const)('preserves drafts and localized validation across %s to %s', async (from, to) => {
    selectLocale(from);
    const view = await mount();
    fireEvent.change(screen.getByRole('textbox', { name: text('cabinet.profile.name.label'), exact: true }), { target: { value: 'LIVE TEST DRAFT' } });
    fireEvent.change(screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }), { target: { value: 'INVALID' } });
    fireEvent.change(screen.getByRole('textbox', { name: text('cabinet.profile.whatsapp.phone.label'), exact: true }), { target: { value: 'WHATSAPP DRAFT' } });
    selectLocale(to);
    await act(async () => view.rerender(<ProfileForm />));
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.name.label'), exact: true }) as HTMLInputElement).value).toBe('LIVE TEST DRAFT');
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }) as HTMLInputElement).value).toBe('INVALID');
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.whatsapp.phone.label'), exact: true }) as HTMLInputElement).value).toBe('WHATSAPP DRAFT');
    expect(screen.getAllByRole('alert').map(element => element.textContent)).toContain(text('cabinet.profile.phone.invalid'));
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: text('common.reset'), exact: true }) as HTMLButtonElement).disabled).toBe(false);
    expect(mockProfileRead).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: text('common.reset'), exact: true }));
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.name.label'), exact: true }) as HTMLInputElement).value).toBe(initialName);
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.phone.label'), exact: true }) as HTMLInputElement).value).toBe('');
    expect((screen.getByRole('textbox', { name: text('cabinet.profile.whatsapp.phone.label'), exact: true }) as HTMLInputElement).value).toBe('');
    expect(global.fetch).toHaveBeenCalledTimes(1);
});
