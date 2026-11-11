import { createClient } from '@supabase/supabase-js';

import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/env';
import { getServiceClient } from '@/lib/supabaseService';

export type VerifiedIdentitySession = { accessToken: string; refreshToken: string };

/** Fresh session after durable consumption: no password reset, email send or token storage. */
export async function issueSessionForVerifiedUser(userId: string): Promise<VerifiedIdentitySession> {
    const admin = getServiceClient();
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(userId);
    if (targetError || target.user?.id !== userId) throw new Error('Sign-in identity unavailable');
    let email = target.user.email;
    if (!email) {
        // Phone-only identities need an internal address for Auth generateLink.
        // Reached only after provider proof + PKCE; UUID avoids address collisions.
        email = `${userId}@auth.kezek.invalid`;
        const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
        if (error) throw new Error('Sign-in identity unavailable');
    }
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
    if (linkError || link.user?.id !== userId || !link.properties?.hashed_token) {
        throw new Error('Sign-in session unavailable');
    }
    const auth = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await auth.auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token });
    if (error || data.user?.id !== userId || !data.session) throw new Error('Sign-in session unavailable');
    return { accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
}

