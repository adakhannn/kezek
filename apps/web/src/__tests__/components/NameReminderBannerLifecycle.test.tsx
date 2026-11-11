/** @jest-environment jsdom */
import { act, render, screen, waitFor } from '@testing-library/react';
import { NameReminderBanner } from '@/app/_components/NameReminderBanner';

let mockPathname = '/catalog';
const mockGetUser = jest.fn();
const mockRpc = jest.fn();
const mockProfile = jest.fn();
const mockAuthUnsubscribe = jest.fn();
const mockProfileUnsubscribe = jest.fn();
const mockAuthListeners = new Set<() => void>();
const mockProfileListeners = new Set<() => void>();
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }));
jest.mock('@/lib/log', () => ({ logWarn: jest.fn() }));
jest.mock('@/lib/supabaseClient', () => ({ supabase: {
    auth: {
        getUser: () => mockGetUser(),
        onAuthStateChange: (callback: () => void) => {
            mockAuthListeners.add(callback);
            return { data: { subscription: { unsubscribe: () => { mockAuthUnsubscribe(); mockAuthListeners.delete(callback); } } } };
        },
    },
    rpc: () => mockRpc(),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => mockProfile() }) }) }),
    channel: () => ({ on: (_event: unknown, _filter: unknown, callback: () => void) => {
        mockProfileListeners.add(callback);
        return { subscribe: () => ({ unsubscribe: () => { mockProfileUnsubscribe(); mockProfileListeners.delete(callback); } }) };
    } }),
} }));
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
beforeEach(() => {
    mockPathname = '/catalog';
    mockGetUser.mockReset().mockResolvedValue({ data: { user: { id: 'synthetic-user' } } });
    mockRpc.mockReset().mockResolvedValue({ data: false });
    mockProfile.mockReset().mockResolvedValue({ data: { full_name: 'Synthetic Name' } });
    mockAuthUnsubscribe.mockReset();
    mockProfileUnsubscribe.mockReset();
    mockAuthListeners.clear();
    mockProfileListeners.clear();
});

test.each(['/cabinet', '/cabinet/profile'])('cabinet route %s never starts profile/auth subscriptions', path => {
    mockPathname = path;
    render(<NameReminderBanner />);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockAuthListeners.size).toBe(0);
    expect(mockProfileListeners.size).toBe(0);
});

test('entering cabinet cleans subscriptions and ignores a late response; leaving starts a fresh check', async () => {
    const late = deferred<{ data: { full_name: string } }>();
    mockProfile.mockReturnValueOnce(late.promise).mockResolvedValueOnce({ data: { full_name: '' } });
    const { rerender, unmount } = render(<NameReminderBanner />);
    await waitFor(() => expect(mockProfile).toHaveBeenCalledTimes(1));
    mockPathname = '/cabinet/profile';
    rerender(<NameReminderBanner />);
    expect(mockAuthUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockProfileUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockAuthListeners.size).toBe(0);
    expect(mockProfileListeners.size).toBe(0);
    await act(async () => late.resolve({ data: { full_name: '' } }));
    expect(screen.queryByText('Заполнить профиль')).toBeNull();
    mockPathname = '/catalog/another';
    rerender(<NameReminderBanner />);
    expect(await screen.findByText('Заполнить профиль')).toBeTruthy();
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    unmount();
    expect(mockAuthUnsubscribe).toHaveBeenCalledTimes(2);
    expect(mockProfileUnsubscribe).toHaveBeenCalledTimes(2);
});

test('a late profile response from an earlier auth state cannot reshow the banner after sign-out', async () => {
    const late = deferred<{ data: { full_name: string } }>();
    mockProfile.mockReturnValueOnce(late.promise);
    render(<NameReminderBanner />);
    await waitFor(() => expect(mockProfile).toHaveBeenCalledTimes(1));
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    await act(async () => { mockAuthListeners.forEach(callback => callback()); });
    expect(mockGetUser).toHaveBeenCalledTimes(2);
    await act(async () => late.resolve({ data: { full_name: '' } }));
    expect(screen.queryByText('Заполнить профиль')).toBeNull();
});
