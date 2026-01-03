// apps/web/src/app/api/notify/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { buildIcs } from '@/lib/ics';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

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
    phone: string | null;
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
    client_phone: string | null;
    client_name: string | null;
    client_email: string | null;
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

    // Вставляем приветствие внутрь первого <div ...>, после закрывающего символа '>'
    const idx = baseHtml.indexOf('>');
    if (idx === -1) return baseHtml; // на всякий случай

    return baseHtml.slice(0, idx + 1) + header + baseHtml.slice(idx + 1);
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
        // Всегда используем kezek.kg для ссылок в письмах, даже если NEXT_PUBLIC_SITE_ORIGIN указывает на vercel.app
        const originEnv = process.env.NEXT_PUBLIC_SITE_ORIGIN || 'https://kezek.kg';
        const origin = originEnv.includes('vercel.app') ? 'https://kezek.kg' : originEnv;

        if (!apiKey) {
            return NextResponse.json({ ok: false, error: 'no RESEND_API_KEY' }, { status: 500 });
        }

        // Supabase client (SSR)
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anon, {
            cookies: { get: (n) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });
        
        // Admin client для получения email владельца
        const admin = createClient(url, service);

        // Получаем данные брони с денормализованными связями
        const { data: raw, error } = await supabase
            .from('bookings')
            .select(`
        id, status, start_at, end_at, created_at, client_id, client_phone, client_name, client_email,
        services:services!bookings_service_id_fkey ( name_ru, duration_min ),
        staff:staff!bookings_staff_id_fkey ( full_name, email, phone ),
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

        // E-mail + имя + телефон + настройки уведомлений клиента
        let clientEmail: string | null = null;
        let clientName: string | null = null;
        let clientPhone: string | null = null;
        let clientNotifyEmail = true;
        let clientNotifyWhatsapp = true;
        let clientWhatsappVerified = false;
        if (raw.client_id) {
            const { data: au } = await supabase
                .from('auth_users_view')
                .select('email, full_name, phone')
                .eq('id', raw.client_id)
                .maybeSingle<{ email: string | null; full_name: string | null; phone: string | null }>();
            clientEmail = au?.email ?? null;
            clientName  = au?.full_name ?? null;
            clientPhone = au?.phone ?? null;
            
            // Получаем данные из profiles (включая настройки уведомлений и статус верификации)
            try {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('phone, full_name, notify_email, notify_whatsapp, whatsapp_verified')
                    .eq('id', raw.client_id)
                    .maybeSingle<{ 
                        phone: string | null; 
                        full_name: string | null;
                        notify_email: boolean | null;
                        notify_whatsapp: boolean | null;
                        whatsapp_verified: boolean | null;
                    }>();
                if (profile) {
                    // Если номер телефона не найден в auth_users_view, берем из profiles
                    if (!clientPhone && profile.phone) {
                        clientPhone = profile.phone;
                        console.log('[notify] Got client phone from profiles table:', clientPhone);
                    }
                    // Если имя не найдено в auth_users_view, берем из profiles
                    if (!clientName && profile.full_name) {
                        clientName = profile.full_name;
                    }
                    // Получаем настройки уведомлений (по умолчанию true, если не указано)
                    clientNotifyEmail = profile.notify_email ?? true;
                    clientNotifyWhatsapp = profile.notify_whatsapp ?? true;
                    clientWhatsappVerified = profile.whatsapp_verified ?? false;
                }
            } catch (e) {
                console.error('[notify] failed to get client data from profiles:', e);
            }
        }
        // Если нет client_id, но есть client_phone (гостевая бронь)
        if (!clientPhone && raw.client_phone) {
            clientPhone = raw.client_phone;
        }
        // Если нет email из auth_users_view, но есть client_email в брони (гостевая бронь с email)
        if (!clientEmail && (raw as { client_email?: string | null }).client_email) {
            clientEmail = (raw as { client_email: string }).client_email;
        }
        // Если нет имени из auth_users_view, но есть client_name в брони (гостевая бронь)
        if (!clientName && raw.client_name) {
            clientName = raw.client_name;
        }

        // E-mail + имя + телефон владельца (через Admin API для надежности)
        let ownerEmail: string | null = null;
        let ownerName: string | null = null;
        let ownerPhone: string | null = null;
        if (biz?.owner_id) {
            try {
                const { data: ou, error: ouError } = await admin.auth.admin.getUserById(biz.owner_id);
                if (!ouError && ou?.user) {
                    ownerEmail = ou.user.email ?? null;
                    const meta = (ou.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                    ownerName = meta.full_name ?? null;
                    // Номер телефона из auth.users.phone (для авторизации по телефону)
                    ownerPhone = (ou.user as { phone?: string | null }).phone ?? null;
                }
            } catch (e) {
                console.error('[notify] failed to get owner data via Admin API:', e);
            }
            
            // Fallback: пробуем через auth_users_view
            if (!ownerEmail || !ownerPhone) {
                try {
                    const { data: ou } = await supabase
                        .from('auth_users_view')
                        .select('email, full_name, phone')
                        .eq('id', biz.owner_id)
                        .maybeSingle<{ email: string | null; full_name: string | null; phone: string | null }>();
                    if (ou) {
                        ownerEmail = ownerEmail || (ou.email ?? null);
                        ownerName = ownerName || (ou.full_name ?? null);
                        ownerPhone = ownerPhone || (ou.phone ?? null);
                    }
                } catch (e) {
                    console.error('[notify] failed to get owner data via auth_users_view:', e);
                }
            }
            
            // Важно: номер телефона может быть в profiles.phone (для связи, не для авторизации)
            if (!ownerPhone) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('phone')
                        .eq('id', biz.owner_id)
                        .maybeSingle<{ phone: string | null }>();
                    if (profile?.phone) {
                        ownerPhone = profile.phone;
                        console.log('[notify] Got owner phone from profiles table:', ownerPhone);
                    }
                } catch (e) {
                    console.error('[notify] failed to get owner phone from profiles:', e);
                }
            }
            
            if (!ownerName) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', biz.owner_id)
                        .maybeSingle<{ full_name: string | null }>();
                    if (profile?.full_name) {
                        ownerName = profile.full_name;
                    }
                } catch (e) {
                    console.error('[notify] failed to get owner name from profiles:', e);
                }
            }
        }

        const staffEmail = staf?.email ?? null;
        const staffPhone = staf?.phone ?? null;
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
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.5;">
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

        // клиент — отдельное письмо с .ics (только если включены email уведомления)
        if (clientEmail && clientNotifyEmail) {
            recipients.push({ email: clientEmail, name: clientName, role: 'client', withIcs: true });
        } else if (clientEmail && !clientNotifyEmail) {
            console.log('[notify] Skipping email to client: notifications disabled');
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

        console.log('[notify] Recipients to notify:', uniqRecipients.length, uniqRecipients.map(r => ({ email: r.email, role: r.role })));
        
        let sent = 0;
        for (const rcp of uniqRecipients) {
            console.log('[notify] Sending email to:', rcp.email, 'role:', rcp.role);
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
            const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            
            if (!emailResponse.ok) {
                const errorText = await emailResponse.text().catch(() => 'Unknown error');
                console.error('[notify] Failed to send email to', rcp.email, 'status:', emailResponse.status, 'error:', errorText);
            } else {
                const result = await emailResponse.json().catch(() => ({}));
                console.log('[notify] Email sent successfully to', rcp.email, 'result:', result);
                sent += 1;
            }
        }

        // SMS уведомления отключены - используем только Email и WhatsApp

        // --- отправляем WhatsApp уведомления
        const whatsappText = `${title}: ${bizName}\n\nУслуга: ${svcName}\nМастер: ${master}\nВремя: ${when}\nСтатус: ${statusRuText}\n\n${link}`;
        let whatsappSent = 0;

        // Проверяем наличие переменных окружения для WhatsApp
        const hasWhatsAppConfig = !!process.env.WHATSAPP_ACCESS_TOKEN && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!hasWhatsAppConfig) {
            console.warn('[notify] WhatsApp not configured: missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
        }

        // WhatsApp клиенту (только если включены WhatsApp уведомления и номер подтвержден)
        if (clientPhone && hasWhatsAppConfig && clientNotifyWhatsapp && clientWhatsappVerified) {
            try {
                const phoneE164 = normalizePhoneToE164(clientPhone);
                if (phoneE164) {
                    console.log('[notify] Sending WhatsApp to client:', phoneE164);
                    await sendWhatsApp({ to: phoneE164, text: whatsappText });
                    whatsappSent += 1;
                    console.log('[notify] WhatsApp to client sent successfully');
                } else {
                    console.warn('[notify] Client phone not normalized:', clientPhone);
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] WhatsApp to client failed:', errorMsg, { phone: clientPhone });
            }
        } else if (clientPhone && !clientNotifyWhatsapp) {
            console.log('[notify] Skipping WhatsApp to client: notifications disabled');
        } else if (clientPhone && !clientWhatsappVerified) {
            console.log('[notify] Skipping WhatsApp to client: phone not verified');
        } else if (!clientPhone) {
            console.log('[notify] No client phone for WhatsApp');
        }

        // WhatsApp мастеру
        if (staffPhone && hasWhatsAppConfig) {
            try {
                const phoneE164 = normalizePhoneToE164(staffPhone);
                if (phoneE164) {
                    console.log('[notify] Sending WhatsApp to staff:', phoneE164);
                    await sendWhatsApp({ to: phoneE164, text: whatsappText });
                    whatsappSent += 1;
                    console.log('[notify] WhatsApp to staff sent successfully');
                } else {
                    console.warn('[notify] Staff phone not normalized:', staffPhone);
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] WhatsApp to staff failed:', errorMsg, { phone: staffPhone });
            }
        } else if (!staffPhone) {
            console.log('[notify] No staff phone for WhatsApp');
        }

        // WhatsApp владельцу
        if (ownerPhone && hasWhatsAppConfig) {
            try {
                const phoneE164 = normalizePhoneToE164(ownerPhone);
                if (phoneE164) {
                    console.log('[notify] Sending WhatsApp to owner:', phoneE164);
                    await sendWhatsApp({ to: phoneE164, text: whatsappText });
                    whatsappSent += 1;
                    console.log('[notify] WhatsApp to owner sent successfully');
                } else {
                    console.warn('[notify] Owner phone not normalized:', ownerPhone);
                }
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] WhatsApp to owner failed:', errorMsg, { phone: ownerPhone });
            }
        } else if (!ownerPhone) {
            console.log('[notify] No owner phone for WhatsApp');
        }

        return NextResponse.json({ ok: true, sent, whatsappSent });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[notify] error:', msg);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
