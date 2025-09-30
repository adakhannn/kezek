export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { buildIcs } from '@/lib/ics';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

type NotifyType = 'hold' | 'confirm' | 'cancel';

interface NotifyBody {
    type: NotifyType;
    booking_id: string;
}

interface ServiceRow {
    name_ru: string;
    duration_min: number;
}
interface StaffRow {
    full_name: string;
    email: string | null;
}
interface BizRow {
    name: string;
    email_notify_to: string[] | null;
    slug: string;
    address: string | null;
    phones: string[] | null;
    owner_id?: string | null;
}
interface BookingRow {
    id: string;
    status: string;
    start_at: string; // ISO
    end_at: string;   // ISO
    created_at: string;
    client_id: string | null;
    services: ServiceRow[] | ServiceRow | null;
    staff:    StaffRow[]    | StaffRow    | null;
    biz:      BizRow[]      | BizRow      | null;
}

/* ---------- helpers ---------- */

function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

function normalizeEmails(list: (string | null | undefined)[]): string[] {
    return Array.from(
        new Set(
            list
                .filter(Boolean)
                .map((e) => String(e).trim().toLowerCase())
                .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
        )
    );
}

/* ---------- route ---------- */

export async function POST(req: Request) {
    try {
        const body: NotifyBody = await req.json();
        if (!body?.type || !body?.booking_id) {
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        }

        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.EMAIL_FROM || 'Kezek <noreply@mail.kezek.kg>';
        const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';

        if (!apiKey) {
            return NextResponse.json({ ok: false, error: 'no RESEND_API_KEY' }, { status: 500 });
        }

        // Supabase client
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anon, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        // Получаем данные брони с денормализованными связями
        const { data: raw, error } = await supabase
            .from('bookings')
            .select(`
        id, status, start_at, end_at, created_at, client_id,
        services:services!bookings_service_id_fkey ( name_ru, duration_min ),
        staff:staff!bookings_staff_id_fkey ( full_name, email ),
        biz:businesses!bookings_biz_id_fkey ( name, email_notify_to, slug, address, phones, owner_id )
      `)
            .eq('id', body.booking_id)
            .maybeSingle<BookingRow>();

        if (error || !raw) {
            return NextResponse.json({ ok: false, error: error?.message || 'not_found' }, { status: 404 });
        }

        const svc  = first<ServiceRow>(raw.services);
        const staf = first<StaffRow>(raw.staff);
        const biz  = first<BizRow>(raw.biz);

        // E-mail клиента
        let clientEmail: string | null = null;
        if (raw.client_id) {
            const { data: au } = await supabase
                .from('auth_users_view')
                .select('email')
                .eq('id', raw.client_id)
                .maybeSingle<{ email: string | null }>();
            clientEmail = au?.email ?? null;
        }

        // E-mail владельца
        let ownerEmail: string | null = null;
        if (biz?.owner_id) {
            const { data: ou } = await supabase
                .from('auth_users_view')
                .select('email')
                .eq('id', biz.owner_id)
                .maybeSingle<{ email: string | null }>();
            ownerEmail = ou?.email ?? null;
        }

        const staffEmail = staf?.email ?? null;
        const adminEmails = biz?.email_notify_to ?? [];

        const title =
            body.type === 'hold'    ? 'Удержание слота' :
                body.type === 'confirm' ? 'Бронь подтверждена' :
                    'Бронь отменена';

        const when = formatInTimeZone(new Date(raw.start_at), TZ, 'dd.MM.yyyy HH:mm');
        const svcName = svc?.name_ru ?? 'Услуга';
        const master  = staf?.full_name ?? 'Мастер';
        const bizName = biz?.name ?? 'Бизнес';
        const link    = `${origin}/booking/${raw.id}`;

        // HTML + текстовая версия (для доставляемости)
        const html = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
        <h2>${title}: ${bizName}</h2>
        <p><b>Услуга:</b> ${svcName}</p>
        <p><b>Мастер:</b> ${master}</p>
        <p><b>Время:</b> ${when} (${TZ})</p>
        <p><b>Статус:</b> ${raw.status}</p>
        <p><a href="${link}" target="_blank" rel="noopener">Открыть бронь</a></p>
        <hr/>
        <small>Письмо отправлено автоматически Kezek</small>
      </div>
    `.trim();

        const text =
            `${title}: ${bizName}\n` +
            `Услуга: ${svcName}\n` +
            `Мастер: ${master}\n` +
            `Время: ${when} (${TZ})\n` +
            `Статус: ${raw.status}\n` +
            `Ссылка: ${link}`;

        // --- формируем получателей
        const toClient = normalizeEmails([clientEmail]); // только клиент
        const toOthers = normalizeEmails([staffEmail, ownerEmail, ...(adminEmails || [])]);

        // --- готовим .ics для клиента
        const icsText = buildIcs({
            id: raw.id,
            summary: `${svcName} — ${bizName}`,
            description: `${title}. Мастер: ${master}`,
            location: biz?.address ?? '',
            startISO: raw.start_at,
            endISO:   raw.end_at,
            tz: TZ,
            url: link,
        });
        const icsBase64 = Buffer.from(icsText, 'utf8').toString('base64');

        // --- отправляем письма через Resend
        const headers = {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        } as const;

        // 1) Клиенту — с ICS
        if (toClient.length) {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    from,
                    to: toClient,
                    subject: `Kezek: ${title}`,
                    html,
                    text,
                    attachments: [{ filename: 'booking.ics', content: icsBase64 }],
                    reply_to: ownerEmail || undefined,
                }),
            });
        }

        // 2) Остальным — без ICS (чтобы не спамить вложениями мастера/владельца)
        if (toOthers.length) {
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    from,
                    to: toOthers,
                    subject: `Kezek: ${title}`,
                    html,
                    text,
                    reply_to: ownerEmail || undefined,
                }),
            });
        }

        return NextResponse.json({
            ok: true,
            sent: (toClient.length ? toClient.length : 0) + (toOthers.length ? toOthers.length : 0),
        });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[notify] error:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
