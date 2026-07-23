export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { syncNotificationEmailsFromUser } from '@/lib/userNotificationEmailService';

export async function GET() {
    const { supabase, admin } = await createSupabaseClients();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ ok: false, error: 'auth' }, { status: 401 });
    }

    await syncNotificationEmailsFromUser(admin, user);
    const { data, error } = await supabase.rpc('get_my_notification_emails');
    if (error) {
        return NextResponse.json(
            { ok: false, error: 'notification_email_lookup_failed' },
            { status: 500 },
        );
    }

    return NextResponse.json({ ok: true, data: data ?? [] });
}
