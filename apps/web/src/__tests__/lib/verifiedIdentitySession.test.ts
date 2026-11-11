import { createClient } from '@supabase/supabase-js';
import { getServiceClient } from '@/lib/supabaseService';
import { issueSessionForVerifiedUser } from '@/lib/verifiedIdentitySession';
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
const id = '00000000-0000-4000-8000-000000000001';
const getUserById = jest.fn();
const updateUserById = jest.fn();
const generateLink = jest.fn();
const verifyOtp = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    getUserById.mockResolvedValue({ data: { user: { id, email: 'synthetic@example.invalid' } }, error: null });
    updateUserById.mockResolvedValue({ error: null });
    generateLink.mockResolvedValue({ data: { user: { id }, properties: { hashed_token: 'internal-hash' } }, error: null });
    verifyOtp.mockResolvedValue({ data: { user: { id }, session: { access_token: 'access', refresh_token: 'refresh' } }, error: null });
    (getServiceClient as jest.Mock).mockReturnValue({ auth: { admin: { getUserById, updateUserById, generateLink } } });
    (createClient as jest.Mock).mockReturnValue({ auth: { verifyOtp } });
});
test('issues an identity-checked session without resetting password or sending a message', async () => {
    expect(await issueSessionForVerifiedUser(id)).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
    expect(generateLink).toHaveBeenCalledWith({ type: 'magiclink', email: 'synthetic@example.invalid' });
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'internal-hash' });
    expect(updateUserById).not.toHaveBeenCalled();
});
test('adds internal UUID email only for a verified phone-only identity', async () => {
    getUserById.mockResolvedValue({ data: { user: { id } }, error: null });
    await issueSessionForVerifiedUser(id);
    expect(updateUserById).toHaveBeenCalledWith(id, { email: id + '@auth.kezek.invalid', email_confirm: true });
});
test.each(['lookup', 'link', 'session'])('rejects identity mismatch at %s', async stage => {
    if (stage === 'lookup') getUserById.mockResolvedValue({ data: { user: { id: 'different' } }, error: null });
    if (stage === 'link') generateLink.mockResolvedValue({ data: { user: { id: 'different' }, properties: { hashed_token: 'internal-hash' } }, error: null });
    if (stage === 'session') verifyOtp.mockResolvedValue({ data: { user: { id: 'different' }, session: { access_token: 'wrong', refresh_token: 'wrong' } }, error: null });
    await expect(issueSessionForVerifiedUser(id)).rejects.toThrow('unavailable');
    if (stage !== 'session') expect(verifyOtp).not.toHaveBeenCalled();
});
