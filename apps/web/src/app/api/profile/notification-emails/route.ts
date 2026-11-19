export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { logError, logWarn } from '@/lib/log';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { syncNotificationEmailsFromUser } from '@/lib/userNotificationEmailService';

export const GET = withLocalizedMessages(async function GET() {
    const { supabase, admin } = await createSupabaseClients();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    }

    // A refused or failed refresh (e.g. NOTIFICATION_EMAIL_NOT_PROVEN) must not hide the
    // user's existing addresses or break the profile form.
    try {
        await syncNotificationEmailsFromUser(admin, user);
    } catch (syncError) {
        logWarn('NotificationEmails', 'Failed to sync notification emails', syncError);
    }
    const { data, error } = await supabase.rpc('get_my_notification_emails');
    if (error) {
        logError('NotificationEmails', 'Failed to load notification emails', error);
        return NextResponse.json(
            { ok: false, error: 'notification_email_lookup_failed' },
            { status: 500 },
        );
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
});
