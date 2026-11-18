import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { cache } from 'react';

import { getUserRoleProfile } from '@/lib/authContext';
import { logWarn } from '@/lib/log';
import type { ShellRoles } from '@/lib/shellAccount';
import { isAuthSessionMissingError } from '@/lib/supabaseAuthRecovery';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

/** Which reminder banner the shell shows: a missing name first, then Telegram notifications. */
export type ShellReminder = 'name' | 'telegram' | null;

export type ShellViewer =
    | { status: 'unavailable' }
    | { status: 'anonymous' }
    | {
          status: 'signed-in';
          userId: string;
          /** Profile name, else the sign-in e-mail or phone; null when there is none. */
          accountLabel: string | null;
          roles: ShellRoles;
          reminder: ShellReminder;
      };

type ProfileRow = { full_name: string | null; telegram_id: number | null; telegram_verified: boolean | null };

async function loadShellViewer(): Promise<ShellViewer> {
    let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    try {
        supabase = await createSupabaseServerClient();
    } catch (error) {
        logWarn('ShellViewer', 'Supabase runtime configuration is invalid', error);
        return { status: 'unavailable' };
    }

    let user: { id: string; email?: string | null; phone?: string | null } | null = null;
    try {
        const { data, error } = await supabase.auth.getUser();
        if (error && !isAuthSessionMissingError(error)) logWarn('ShellViewer', 'Supabase user lookup failed', error);
        else user = data.user;
    } catch (error) {
        if (!isAuthSessionMissingError(error)) logWarn('ShellViewer', 'Supabase user lookup failed', error);
    }
    if (!user) return { status: 'anonymous' };

    const [roleProfile, profileResult] = await Promise.all([
        getUserRoleProfile(supabase as SupabaseClient),
        supabase
            .from('profiles')
            .select('full_name, telegram_id, telegram_verified')
            .eq('id', user.id)
            .maybeSingle<ProfileRow>(),
    ]);
    if (profileResult.error) logWarn('ShellViewer', 'Profile lookup failed', profileResult.error);

    const profile = profileResult.error ? null : profileResult.data;
    const fullName = profile?.full_name?.trim() || null;
    const isSuperAdmin = !!roleProfile?.isSuperAdmin;

    let reminder: ShellReminder = null;
    // Reminders need a profile that was actually read; the platform admin never gets them.
    if (!isSuperAdmin && !profileResult.error) {
        if (!fullName) reminder = 'name';
        else if (!(profile?.telegram_id && profile.telegram_verified)) reminder = 'telegram';
    }

    return {
        status: 'signed-in',
        userId: user.id,
        accountLabel: fullName || user.email || user.phone || null,
        roles: {
            hasDashboard: !!roleProfile?.canDashboard,
            hasStaff: !!roleProfile?.canStaff,
            hasCabinet: true,
            hasAdmin: !!roleProfile?.canAdmin,
        },
        reminder,
    };
}

/**
 * Identity of the viewer for the app shell (header, account menu, reminder banners), loaded once
 * per request on the server. The shell used to ask the browser to repeat the same user, role and
 * profile queries in four components on every page.
 */
export const getShellViewer = cache(loadShellViewer);
