export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type Body = {
    biz_id?: string;
    branch_id?: string;
    service_id?: string;
    staff_id?: string;
    start_at?: string; // ISO с таймзоной
    duration_min?: number;
    client_name?: string | null;
    client_phone?: string | null;
};

function normStr(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

export async function POST(req: Request) {
    try {
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        const admin = createClient(SUPABASE_URL, SERVICE);

        const raw = (await req.json().catch(() => ({}))) as Body;
        const biz_id = normStr(raw.biz_id);
        const branch_id = normStr(raw.branch_id);
        const service_id = normStr(raw.service_id);
        const staff_id = normStr(raw.staff_id);
        const start_at = normStr(raw.start_at);
        const duration_min = Number(raw.duration_min || 0) || 0;
        const client_name = normStr(raw.client_name ?? null);
        const client_phone = normStr(raw.client_phone ?? null);

        if (!biz_id || !branch_id || !service_id || !staff_id || !start_at || !duration_min) {
            return NextResponse.json(
                { ok: false, error: 'missing_fields', message: 'Не хватает данных для записи' },
                { status: 400 }
            );
        }

        if (!client_name && !client_phone) {
            return NextResponse.json(
                { ok: false, error: 'missing_client', message: 'Укажите имя или телефон' },
                { status: 400 }
            );
        }

        const { data, error } = await admin.rpc('create_internal_booking', {
            p_biz_id: biz_id,
            p_branch_id: branch_id,
            p_service_id: service_id,
            p_staff_id: staff_id,
            p_start: start_at,
            p_minutes: duration_min,
            p_client_id: null,
            p_client_name: client_name,
            p_client_phone: client_phone,
        });

        if (error) {
            const msg = (error as { message?: string }).message ?? 'RPC error';
            return NextResponse.json({ ok: false, error: 'rpc', message: msg }, { status: 400 });
        }

        const bookingId = String(data);

        // Уведомление как при обычном confirm
        try {
            await fetch(new URL('/api/notify', req.url), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ type: 'confirm', booking_id: bookingId }),
            });
        } catch (e) {
            console.error('notify guest booking failed', e);
        }

        return NextResponse.json({ ok: true, booking_id: bookingId });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('guest-create booking error', e);
        return NextResponse.json({ ok: false, error: 'internal', message: msg }, { status: 500 });
    }
}


