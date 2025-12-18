// apps/web/src/app/api/notify/route.ts
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

function greet(name?: string | null) {
    return name?.trim() ? `Здравствуйте, ${name}!` : `Здравствуйте!`;
}

type RoleKey = 'client' | 'staff' | 'owner' | 'admin';
function roleRu(role: RoleKey) {
    switch (role) {
        case 'client': return 'Клиент';
        case 'staff':  return 'Мастер';
        case 'owner':  return 'Владелец';
        default:       return 'Администратор';
    }
}

function statusRu(status: string): string {
    switch (status) {
        case 'hold':
            return 'Ожидает подтверждения';
        case 'confirmed':
            return 'Подтверждена';
        case 'paid':
            return 'Оплачена';
        case 'cancelled':
            return 'Отменена';
        default:
            return status;
    }
}

function buildHtmlPersonal(
    baseHtml: string,
    name: string | null | undefined,
    role: RoleKey
) {
    const header =
        `<p style="margin:0 0 12px 0">${greet(name)} <i>(${roleRu(role)})</i></p>`;
    // безопасно вставляем приветствие в начало корневого контейнера
    return baseHtml.replace('<div', `<div>${header}`);
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

        // Supabase client (SSR)
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

        // E-mail + имя клиента
        let clientEmail: string | null = null;
        let clientName: string | null = null;
        if (raw.client_id) {
            const { data: au } = await supabase
                .from('auth_users_view')
                .select('email, full_name')
                .eq('id', raw.client_id)
                .maybeSingle<{ email: string | null; full_name: string | null }>();
            clientEmail = au?.email ?? null;
            clientName  = au?.full_name ?? null;
        }

        // E-mail + имя владельца
        let ownerEmail: string | null = null;
        let ownerName: string | null = null;
        if (biz?.owner_id) {
            const { data: ou } = await supabase
                .from('auth_users_view')
                .select('email, full_name')
                .eq('id', biz.owner_id)
                .maybeSingle<{ email: string | null; full_name: string | null }>();
            ownerEmail = ou?.email ?? null;
            ownerName  = ou?.full_name ?? null;
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
        const statusRuText = statusRu(raw.status);

        // HTML + текстовая версия (базовая, без персонализации)
        const baseHtml = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 12px 0">${title}: ${bizName}</h2>
        <p style="margin:0 0 6px 0"><b>Услуга:</b> ${svcName}</p>
        <p style="margin:0 0 6px 0"><b>Мастер:</b> ${master}</p>
        <p style="margin:0 0 6px 0"><b>Время:</b> ${when} (${TZ})</p>
        <p style="margin:0 0 10px 0"><b>Статус:</b> ${statusRuText}</p>
        <p style="margin:0 0 12px 0"><a href="${link}" target="_blank" rel="noopener">Открыть бронь</a></p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0" />
        <small style="color:#6b7280">Письмо отправлено автоматически Kezek</small>
      </div>
    `.trim();

        const text =
            `${title}: ${bizName}\n` +
            `Услуга: ${svcName}\n` +
            `Мастер: ${master}\n` +
            `Время: ${when} (${TZ})\n` +
            `Статус: ${statusRuText}\n` +
            `Ссылка: ${link}`;

        // --- формируем получателей
        type Recipient = {
            email: string;
            name: string | null;
            role: RoleKey;
            withIcs?: boolean;
        };

        const recipients: Recipient[] = [];

        // клиент — отдельное письмо с .ics
        if (clientEmail) {
            recipients.push({ email: clientEmail, name: clientName, role: 'client', withIcs: true });
        }

        // мастер
        if (staffEmail) {
            recipients.push({ email: staffEmail, name: staf?.full_name ?? null, role: 'staff' });
        }

        // владелец
        if (ownerEmail) {
            recipients.push({ email: ownerEmail, name: ownerName, role: 'owner' });
        }

        // администраторы из списка
        for (const em of normalizeEmails(adminEmails ?? [])) {
            recipients.push({ email: em, name: null, role: 'admin' });
        }

        // дедуп по email (оставляем первый встретившийся вариант)
        const uniqMap = new Map<string, Recipient>();
        for (const r of recipients) if (!uniqMap.has(r.email)) uniqMap.set(r.email, r);
        const uniqRecipients = Array.from(uniqMap.values());

        // --- готовим .ics для клиента (один раз)
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

        // --- отправляем письма через Resend (персонально)
        const headers = {
            'content-type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
        } as const;

        let sent = 0;
        for (const rcp of uniqRecipients) {
            const htmlPersonal = buildHtmlPersonal(baseHtml, rcp.name, rcp.role);
            const payload: Record<string, unknown> = {
                from,
                to: [rcp.email],
                subject: `Kezek: ${title}`,
                html: htmlPersonal,
                text,
                reply_to: ownerEmail || undefined,
            };
            if (rcp.withIcs) {
                payload.attachments = [{ filename: 'booking.ics', content: icsBase64 }];
            }
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            sent += 1;
        }

        return NextResponse.json({ ok: true, sent });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[notify] error:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
