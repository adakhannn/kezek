export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

// утилита: если массив — берём первый элемент
function first<T>(v: T | T[] | null | undefined): T | null {
    if (!v) return null;
    return Array.isArray(v) ? (v[0] ?? null) : v;
}

/* ---------- Типы ---------- */
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
    start_at: string;
    end_at: string;
    created_at: string;
    client_id: string | null;
    services: ServiceRow[] | ServiceRow | null;
    staff: StaffRow[] | StaffRow | null;
    biz: BizRow[] | BizRow | null;
}
type NotifyType = 'hold' | 'confirm' | 'cancel';

interface NotifyBody {
    type: NotifyType;
    booking_id: string;
}

/* ---------- Отправка письма ---------- */
async function sendEmail(to: string, subject: string, html: string) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');
    const from = process.env.EMAIL_FROM || 'Kezek <noreply@mail.kezek.kg>';

    const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ from, to, subject, html }),
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Resend error: ${resp.status} ${text}`);
    }
}

/* ---------- Основной обработчик ---------- */
export async function POST(req: Request) {
    try {
        const body: NotifyBody = await req.json();
        if (!body?.type || !body?.booking_id) {
            return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
        }

        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anon, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

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

        const svc = first(raw.services);
        const staff = first(raw.staff);
        const biz = first(raw.biz);

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

        const staffEmail = staff?.email ?? null;
        const adminEmails = biz?.email_notify_to ?? [];

        const title =
            body.type === 'hold' ? 'Удержание слота'
                : body.type === 'confirm' ? 'Бронь подтверждена'
                    : 'Бронь отменена';

        const when = formatInTimeZone(new Date(raw.start_at), TZ, 'dd.MM.yyyy HH:mm');
        const svcName = svc?.name_ru ?? 'Услуга';
        const master = staff?.full_name ?? 'Мастер';
        const bizName = biz?.name ?? 'Бизнес';
        const origin = process.env.NEXT_PUBLIC_SITE_ORIGIN || '';
        const link = `${origin}/booking/${raw.id}`;

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
    `;

        // Список получателей
        const recipients = new Set<string>();
        if (clientEmail) recipients.add(clientEmail);
        if (staffEmail) recipients.add(staffEmail);
        if (ownerEmail) recipients.add(ownerEmail);
        for (const e of adminEmails) if (e) recipients.add(e);

        if (recipients.size === 0) {
            return NextResponse.json({ ok: true, sent: 0 });
        }

        let sent = 0;
        for (const to of recipients) {
            try {
                await sendEmail(to, `Kezek: ${title}`, html);
                sent++;
            } catch (err) {
                console.error('sendEmail error', to, err);
            }
        }

        return NextResponse.json({ ok: true, sent });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ ok: false, error: 'internal' }, { status: 500 });
    }
}

