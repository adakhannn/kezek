/** @jest-environment node */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import ProfilePage from '@/app/cabinet/profile/page';
import ProfilePageClient from '@/app/cabinet/profile/ProfilePageClient';

jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn() }));
jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/app/cabinet/profile/ProfilePageClient', () => ({
    __esModule: true,
    default: jest.fn(() => null),
}));

const redirectSignal = new Error('UNIT redirect sentinel');
const getUser = jest.fn();
const readCookie = jest.fn();
const from = jest.fn();

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((complete) => { resolve = complete; });
    return { promise, resolve };
}

beforeEach(() => {
    jest.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: 'unit-server-profile-user' } } });
    readCookie.mockReturnValue(undefined);
    (cookies as jest.Mock).mockResolvedValue({ get: readCookie });
    (createServerClient as jest.Mock).mockReturnValue({ auth: { getUser }, from });
    (redirect as unknown as jest.Mock).mockImplementation(() => { throw redirectSignal; });
});

it('returns the existing client shell for a server-authenticated identity without reading profile data', async () => {
    const page = await ProfilePage();
    expect(page.type).toBe(ProfilePageClient);
    expect(page.props).toEqual({});
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
    expect(ProfilePageClient).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
});

it.each([null, { id: '' }])('does not return the profile shell for a server user without a usable ID: %p', async (user) => {
    getUser.mockResolvedValue({ data: { user } });
    await expect(ProfilePage()).rejects.toBe(redirectSignal);
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/auth/sign-in');
    expect(from).not.toHaveBeenCalled();
    expect(ProfilePageClient).not.toHaveBeenCalled();
});

it('propagates a rejected server identity read instead of returning an authenticated shell', async () => {
    const failure = new Error('UNIT server authentication unavailable');
    getUser.mockRejectedValue(failure);
    await expect(ProfilePage()).rejects.toBe(failure);
    expect(redirect).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    expect(ProfilePageClient).not.toHaveBeenCalled();
});

it('does not construct a client when the server cookie context fails', async () => {
    const failure = new Error('UNIT cookie context unavailable');
    (cookies as jest.Mock).mockRejectedValue(failure);
    await expect(ProfilePage()).rejects.toBe(failure);
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
});

it('waits for the server cookie context before starting authentication', async () => {
    const pending = deferred<{ get: typeof readCookie }>();
    (cookies as jest.Mock).mockReturnValue(pending.promise);
    const result = ProfilePage();
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
    pending.resolve({ get: readCookie });
    expect((await result).type).toBe(ProfilePageClient);
    expect(getUser).toHaveBeenCalledTimes(1);
});

it('does not settle the route while its server identity lookup remains pending', async () => {
    const pending = deferred<{ data: { user: { id: string } } }>();
    getUser.mockReturnValue(pending.promise);
    let settled = false;
    const result = ProfilePage().then((page) => { settled = true; return page; });
    await Promise.resolve();
    await Promise.resolve();
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(settled).toBe(false);
    expect(redirect).not.toHaveBeenCalled();
    pending.resolve({ data: { user: { id: 'unit-server-profile-user' } } });
    expect((await result).type).toBe(ProfilePageClient);
});

it('provides only a read adapter to the supplied server cookie store', async () => {
    await ProfilePage();
    const options = (createServerClient as jest.Mock).mock.calls[0][2];
    expect(Object.keys(options.cookies)).toEqual(['get']);
    readCookie.mockReturnValueOnce({ value: 'unit-synthetic-value' }).mockReturnValueOnce(undefined);
    expect(options.cookies.get('unit-existing')).toBe('unit-synthetic-value');
    expect(options.cookies.get('unit-missing')).toBeUndefined();
    expect(readCookie.mock.calls).toEqual([['unit-existing'], ['unit-missing']]);
});

it('propagates server client construction failure without attempting authentication', async () => {
    const failure = new Error('UNIT server client unavailable');
    (createServerClient as jest.Mock).mockImplementationOnce(() => { throw failure; });
    await expect(ProfilePage()).rejects.toBe(failure);
    expect(getUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
});

// These route-level mocks establish initial server gating only. The production
// shell receives no identity/profile snapshot and the browser reads identity
// independently. They do not close G141's post-server client failure cases,
// establish real session-expiry reachability, or prove live HTTP/RLS behavior.
