/** @jest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { en, ky, ru } from '@/app/_components/i18n/dictionaries';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';
import ProfileForm from '@/app/cabinet/components/ProfileForm';
import { logError } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/app/_components/i18n/LanguageProvider', () => ({ useLanguage: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));
jest.mock('@/app/cabinet/components/AccountDeletionPanel', () => ({ AccountDeletionPanel: () => null }));
jest.mock('@/app/cabinet/components/TelegramBotLink', () => ({ TelegramBotLink: () => null }));
jest.mock('@/app/cabinet/components/TelegramLinkWidget', () => ({ TelegramLinkWidget: () => null }));
jest.mock('@/app/cabinet/components/ConnectionUnlinkConfirmation', () => ({ ConnectionUnlinkConfirmation: () => null }));

const dictionaries = { ru, en, ky };
type Locale = keyof typeof dictionaries;
const fixtureName = 'UNIT PROFILE IDENTITY';
const fixtureUser = { id: 'unit-profile-user', identities: [{ provider: 'google' }] };
const fixtureProfile = { full_name: fixtureName, phone: null, whatsapp_phone: null, notify_email: false };
let locale: Locale;
let profileRead: jest.Mock;
let originalFetch: typeof fetch;

function selectLocale(next: Locale) {
    locale = next;
    (useLanguage as jest.Mock).mockReturnValue({
        locale,
        t: (key: string, fallback?: string) => dictionaries[locale][key] ?? fallback ?? key,
    });
}
function text(key: string) { return dictionaries[locale][key]; }
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => { resolve = complete; });
    return { promise, resolve };
}
function expectIdentityHidden() {
    expect(screen.queryByRole('textbox', { name: text('cabinet.profile.name.label'), exact: true })).toBeNull();
    expect(screen.queryAllByRole('button', { name: text('cabinet.profile.connections.connect'), exact: true })).toHaveLength(0);
    expect(screen.queryByText(text('cabinet.profile.synced'))).toBeNull();
}
async function waitUntilSettled() {
    await waitFor(() => expect(screen.queryByText(text('cabinet.profile.loading'))).toBeNull());
}

beforeEach(() => {
    jest.clearAllMocks();
    selectLocale('ru');
    originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ ok: true, data: [] }) })) as jest.Mock;
    profileRead = jest.fn().mockResolvedValue({ data: fixtureProfile, error: null });
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: fixtureUser } });
    (supabase.from as jest.Mock).mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: profileRead }) }) });
});
afterEach(() => { global.fetch = originalFetch; });

it.each(['ru', 'en', 'ky'] as const)('keeps identity controls hidden while %s authentication is pending', (next) => {
    selectLocale(next);
    (supabase.auth.getUser as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<ProfileForm />);
    expect(screen.getByText(text('cabinet.profile.loading'))).toBeTruthy();
    expectIdentityHidden();
    expect(profileRead).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});

it('keeps the boundary while the profile query is pending', async () => {
    profileRead.mockReturnValue(new Promise(() => undefined));
    render(<ProfileForm />);
    await waitFor(() => expect(profileRead).toHaveBeenCalledTimes(1));
    expect(screen.getByText(text('cabinet.profile.loading'))).toBeTruthy();
    expectIdentityHidden();
});

it('does not reveal a partially loaded form before notification identities settle', async () => {
    const notification = deferred<{ ok: boolean; json: () => Promise<{ ok: boolean; data: never[] }> }>();
    (global.fetch as jest.Mock).mockReturnValue(notification.promise);
    render(<ProfileForm />);
    await waitFor(() => expect(profileRead).toHaveBeenCalledTimes(1));
    expectIdentityHidden();
    await act(async () => notification.resolve({ ok: true, json: async () => ({ ok: true, data: [] }) }));
    await screen.findByDisplayValue(fixtureName);
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
});

it.each(['rejected', 'non-ok', 'malformed-json'] as const)('retains a loaded profile when optional notification lookup is %s', async (failure) => {
    if (failure === 'rejected') (global.fetch as jest.Mock).mockRejectedValue(new Error('unit network failure'));
    if (failure === 'non-ok') (global.fetch as jest.Mock).mockResolvedValue({ ok: false, json: async () => ({ ok: false }) });
    if (failure === 'malformed-json') (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => { throw new Error('unit malformed response'); } });
    render(<ProfileForm />);
    await screen.findByDisplayValue(fixtureName);
    expect(screen.queryByText(text('cabinet.profile.loading'))).toBeNull();
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByText(text('cabinet.profile.connections.connected')).length).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
});

// These isolated tests cover the unknown-identity boundary, not live UI acceptance.
it('does not advertise an editable empty identity after the profile read fails', async () => {
    const failure = { message: 'unit profile read failure' };
    profileRead.mockResolvedValue({ data: null, error: failure });
    render(<ProfileForm />);
    await waitUntilSettled();
    expect(logError).toHaveBeenCalledWith('ProfileForm', 'Error loading profile', failure);
    expectIdentityHidden();
});

it('does not advertise an editable empty identity after authentication rejects', async () => {
    const failure = new Error('unit auth failure');
    (supabase.auth.getUser as jest.Mock).mockRejectedValue(failure);
    render(<ProfileForm />);
    await waitUntilSettled();
    expect(profileRead).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith('ProfileForm', 'Error loading profile', failure);
    expectIdentityHidden();
});

it('does not advertise an editable empty identity when authentication returns no user', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: null } });
    render(<ProfileForm />);
    await waitUntilSettled();
    expect(profileRead).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expectIdentityHidden();
});

it('rejects an authentication error even when a user object is present', async () => {
    const failure = { message: 'unit invalid auth session' };
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({ data: { user: fixtureUser }, error: failure });
    render(<ProfileForm />);
    await screen.findByRole('alert');
    expect(profileRead).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
    expectIdentityHidden();
    expect(logError).toHaveBeenCalledWith('ProfileForm', 'Error loading profile', failure);
});

it.each(['ru', 'en', 'ky'] as const)('recovers from a %s profile read error only after an explicit successful retry', async (next) => {
    selectLocale(next);
    profileRead.mockResolvedValueOnce({ data: null, error: { message: 'unit profile unavailable' } });
    render(<ProfileForm />);
    expect((await screen.findByRole('alert')).textContent).toContain(text('cabinet.profile.error.load'));
    expectIdentityHidden();
    const retry = deferred<{ data: { user: typeof fixtureUser } }>();
    (supabase.auth.getUser as jest.Mock).mockReturnValueOnce(retry.promise);
    fireEvent.click(screen.getByRole('button', { name: text('cabinet.profile.retry') }));
    expect(screen.getByText(text('cabinet.profile.loading'))).toBeTruthy();
    expectIdentityHidden();
    await act(async () => retry.resolve({ data: { user: fixtureUser } }));
    await screen.findByDisplayValue(fixtureName);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(profileRead).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect((screen.getByRole('button', { name: text('cabinet.profile.save'), exact: true }) as HTMLButtonElement).disabled).toBe(true);
});
