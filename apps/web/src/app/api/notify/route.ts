// apps/web/src/app/api/notify/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { formatInTimeZone } from 'date-fns-tz';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { getTimezone } from '@/lib/env';
import { buildIcs } from '@/lib/ics';
import { normalizePhoneToE164 } from '@/lib/senders/sms';
import { sendTelegram } from '@/lib/senders/telegram';
import { sendWhatsApp } from '@/lib/senders/whatsapp';

const TZ = getTimezone();

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
    user_id?: string | null;
}
interface BizRow {
    name: string;
    email_notify_to: string[] | null;
    slug: string;
    address: string | null;
    phones: string[] | null;
    owner_id?: string | null;
}
interface BranchRow {
    name: string;
    address: string | null;
}
interface ServiceRow {
    name_ru: string;
    duration_min: number;
    price_from: number | null;
    price_to: number | null;
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
    branches: BranchRow[]   | BranchRow   | null;
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
            return 'Выполнена';
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
    // Логируем в самом начале, чтобы убедиться, что endpoint вызывается
    console.log('[notify] ===== NOTIFY ENDPOINT CALLED =====');
    console.log('[notify] Request URL:', req.url);
    console.log('[notify] Request method:', req.method);
    console.log('[notify] Request headers:', Object.fromEntries(req.headers.entries()));
    
    try {
        const body: NotifyBody = await req.json();
        console.log('[notify] Received notification request:', { type: body?.type, booking_id: body?.booking_id });
        
        if (!body?.type || !body?.booking_id) {
            console.error('[notify] Bad request: missing type or booking_id');
            return createErrorResponse('validation', 'Missing type or booking_id', undefined, 400);
        }

        const { getResendApiKey, getEmailFrom, getSiteOrigin, getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } = await import('@/lib/env');
        
        let apiKey: string;
        try {
            apiKey = getResendApiKey();
        } catch (error) {
            console.error('[notify] RESEND_API_KEY is not set');
            return createErrorResponse('internal', 'RESEND_API_KEY is not set', undefined, 500);
        }
        
        const from = getEmailFrom();
        // Всегда используем kezek.kg для ссылок в письмах, даже если NEXT_PUBLIC_SITE_ORIGIN указывает на vercel.app
        const originEnv = getSiteOrigin();
        const origin = originEnv.includes('vercel.app') ? 'https://kezek.kg' : originEnv;
        
        console.log('[notify] Resend API key found, from:', from);
        console.log('[notify] Email configuration:', {
            from,
            domain: from.includes('@') ? from.split('@')[1] : 'unknown',
            note: 'Make sure domain is verified in Resend Dashboard with SPF/DKIM records',
        });

        // Supabase client (SSR)
        const url = getSupabaseUrl();
        const anon = getSupabaseAnonKey();
        const service = getSupabaseServiceRoleKey();
        const cookieStore = await cookies();
        const supabase = createServerClient(url, anon, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });
        
        // Admin client для получения email владельца и чтения брони (обход RLS)
        const admin = createClient(url, service);

        // Получаем данные брони с денормализованными связями
        // Используем admin client для обхода RLS политик (бронь может быть только что создана)
        console.log('[notify] Fetching booking data for booking_id:', body.booking_id);
        const { data: raw, error } = await admin
            .from('bookings')
            .select(`
        id, status, start_at, end_at, created_at, client_id, client_phone, client_name, client_email,
        services:services!bookings_service_id_fkey ( name_ru, duration_min, price_from, price_to ),
        staff:staff!bookings_staff_id_fkey ( full_name, email, phone, user_id ),
        biz:businesses!bookings_biz_id_fkey ( name, email_notify_to, slug, address, phones, owner_id ),
        branches:branches!bookings_branch_id_fkey ( name, address )
      `)
            .eq('id', body.booking_id)
            .maybeSingle<BookingRow>();

        if (error || !raw) {
            console.error('[notify] Booking not found or error:', {
                booking_id: body.booking_id,
                error: error?.message,
                hasRaw: !!raw,
                errorDetails: error,
            });
            return NextResponse.json({ ok: false, error: error?.message || 'not_found' }, { status: 404 });
        }
        
        console.log('[notify] Booking found:', { booking_id: raw.id, status: raw.status });

        const svc  = first<ServiceRow>(raw.services);
        const staf = first<StaffRow>(raw.staff);
        const biz  = first<BizRow>(raw.biz);

        console.log('[notify] Booking data:', {
            booking_id: raw.id,
            staff: staf ? { full_name: staf?.full_name, email: staf?.email, phone: staf?.phone, user_id: 'user_id' in staf ? staf.user_id : null } : null,
            biz: biz ? { name: biz.name, owner_id: biz.owner_id } : null,
        });

        // E-mail + имя + телефон + настройки уведомлений клиента
        let clientEmail: string | null = null;
        let clientName: string | null = null;
        let clientPhone: string | null = null;
        let clientNotifyEmail = true;
        let clientNotifyWhatsapp = true;
        let clientWhatsappVerified = false;
        let clientTelegramId: number | null = null;
        let clientNotifyTelegram = true;
        let clientTelegramVerified = false;
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
                        .select('phone, full_name, notify_email, notify_whatsapp, whatsapp_verified, telegram_id, notify_telegram, telegram_verified')
                        .eq('id', raw.client_id)
                        .maybeSingle<{
                            phone: string | null;
                            full_name: string | null;
                            notify_email: boolean | null;
                            notify_whatsapp: boolean | null;
                            whatsapp_verified: boolean | null;
                            telegram_id: number | null;
                            notify_telegram: boolean | null;
                            telegram_verified: boolean | null;
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
                    clientTelegramId = profile.telegram_id ?? null;
                    clientNotifyTelegram = profile.notify_telegram ?? true;
                    clientTelegramVerified = profile.telegram_verified ?? false;
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

        // E-mail + имя + телефон + telegram_id владельца
        // ВАЖНО: email для уведомлений берется из email_notify_to (приоритет), а не из auth.users
        // email из auth.users используется только как fallback, если email_notify_to пустой
        let ownerEmail: string | null = null;
        let ownerEmailFromAuth: string | null = null; // Сохраняем email из auth.users только для fallback
        let ownerName: string | null = null;
        let ownerPhone: string | null = null;
        let ownerTelegramId: number | null = null;
        let ownerNotifyTelegram = true;
        let ownerTelegramVerified = false;
        if (biz?.owner_id) {
            console.log('[notify] Getting owner data for owner_id:', biz.owner_id);
            try {
                const { data: ou, error: ouError } = await admin.auth.admin.getUserById(biz.owner_id);
                if (!ouError && ou?.user) {
                    ownerEmailFromAuth = ou.user.email ?? null; // Сохраняем для fallback
                    const meta = (ou.user.user_metadata ?? {}) as Partial<{ full_name: string }>;
                    ownerName = meta.full_name ?? null;
                    // Номер телефона из auth.users.phone (для авторизации по телефону)
                    ownerPhone = (ou.user as { phone?: string | null }).phone ?? null;
                    console.log('[notify] Got owner data via Admin API:', { email: ownerEmailFromAuth, name: ownerName, phone: ownerPhone });
                } else {
                    console.log('[notify] Failed to get owner data via Admin API:', { error: ouError?.message, hasUser: !!ou?.user });
                }
            } catch (e) {
                console.error('[notify] failed to get owner data via Admin API:', e);
            }
            
            // Fallback: пробуем через auth_users_view
            if (!ownerEmailFromAuth || !ownerPhone) {
                try {
                    const { data: ou } = await supabase
                        .from('auth_users_view')
                        .select('email, full_name, phone')
                        .eq('id', biz.owner_id)
                        .maybeSingle<{ email: string | null; full_name: string | null; phone: string | null }>();
                    if (ou) {
                        ownerEmailFromAuth = ownerEmailFromAuth || (ou.email ?? null);
                        ownerName = ownerName || (ou.full_name ?? null);
                        ownerPhone = ownerPhone || (ou.phone ?? null);
                        console.log('[notify] Got owner data from auth_users_view:', { email: ownerEmailFromAuth, phone: ownerPhone });
                    } else {
                        console.log('[notify] No owner data found in auth_users_view for owner_id:', biz.owner_id);
                    }
                } catch (e) {
                    console.error('[notify] failed to get owner data via auth_users_view:', e);
                }
            }
            
            console.log('[notify] Owner data summary:', {
                owner_id: biz.owner_id,
                ownerEmailFromAuth, // Email из auth.users (используется только как fallback)
                ownerEmail, // Email для уведомлений (будет установлен из email_notify_to или fallback)
                ownerName,
                ownerPhone,
                ownerTelegramId,
                hasEmail: !!ownerEmailFromAuth,
                emailLength: ownerEmailFromAuth?.length || 0,
            });
            
            // Важно: номер телефона может быть в profiles.phone (для связи, не для авторизации)
            // Используем admin client для обхода RLS
            if (!ownerPhone) {
                try {
                    const { data: profile } = await admin
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
                    const { data: profile } = await admin
                        .from('profiles')
                        .select('full_name, telegram_id, notify_telegram, telegram_verified')
                        .eq('id', biz.owner_id)
                        .maybeSingle<{ 
                            full_name: string | null;
                            telegram_id: number | null;
                            notify_telegram: boolean | null;
                            telegram_verified: boolean | null;
                        }>();
                    if (profile) {
                        if (profile.full_name) {
                            ownerName = profile.full_name;
                        }
                        ownerTelegramId = profile.telegram_id ?? null;
                        ownerNotifyTelegram = profile.notify_telegram ?? true;
                        ownerTelegramVerified = profile.telegram_verified ?? false;
                        console.log('[notify] Got owner telegram data from profiles:', {
                            telegram_id: ownerTelegramId,
                            notify_telegram: ownerNotifyTelegram,
                            telegram_verified: ownerTelegramVerified,
                        });
                    }
                } catch (e) {
                    console.error('[notify] failed to get owner name from profiles:', e);
                }
            }
        }

        const staffEmail = staf?.email ?? null;
        const staffPhone = staf?.phone ?? null;
        
        // Получаем telegram_id мастера (если у мастера есть user_id)
        // Используем admin client для обхода RLS политик
        let staffTelegramId: number | null = null;
        let staffNotifyTelegram = true;
        let staffTelegramVerified = false;
        if (staf && 'user_id' in staf && staf.user_id) {
            try {
                console.log('[notify] Getting staff telegram data for user_id:', staf.user_id);
                const { data: profile } = await admin
                    .from('profiles')
                    .select('telegram_id, notify_telegram, telegram_verified')
                    .eq('id', staf.user_id)
                    .maybeSingle<{ 
                        telegram_id: number | null;
                        notify_telegram: boolean | null;
                        telegram_verified: boolean | null;
                    }>();
                if (profile) {
                    staffTelegramId = profile.telegram_id ?? null;
                    staffNotifyTelegram = profile.notify_telegram ?? true;
                    staffTelegramVerified = profile.telegram_verified ?? false;
                    console.log('[notify] Staff telegram data:', {
                        telegram_id: staffTelegramId,
                        notify_telegram: staffNotifyTelegram,
                        telegram_verified: staffTelegramVerified,
                    });
                } else {
                    console.log('[notify] No profile found for staff user_id:', staf.user_id);
                }
            } catch (e) {
                console.error('[notify] failed to get staff telegram data from profiles:', e);
            }
        } else {
            console.log('[notify] Staff has no user_id, cannot get telegram data:', {
                hasStaff: !!staf,
                hasUserId: staf && 'user_id' in staf ? !!staf.user_id : false,
            });
        }
        const adminEmails = biz?.email_notify_to ?? [];
        
        // ПРИОРИТЕТ: email для уведомлений владельца берется из email_notify_to, а НЕ из auth.users
        // email из auth.users (ownerEmailFromAuth) используется только как fallback, если email_notify_to пустой
        // Это позволяет владельцу указать другой email для уведомлений, отличный от email аккаунта
        // Например, если владелец авторизован через lowfade.9909@gmail.com, но хочет получать уведомления на low.fade.osh@gmail.com
        if (adminEmails.length > 0) {
            const normalizedAdminEmails = normalizeEmails(adminEmails);
            if (normalizedAdminEmails.length > 0) {
                const primaryNotifyEmail = normalizedAdminEmails[0];
                console.log('[notify] Using email from email_notify_to for owner notifications:', {
                    emailFromAuth: ownerEmailFromAuth, // Email из auth.users (не используется для уведомлений)
                    notifyEmail: primaryNotifyEmail, // Email из email_notify_to (используется для уведомлений)
                    allNotifyEmails: normalizedAdminEmails,
                    note: 'email_notify_to takes priority - email from auth.users is NOT used for notifications',
                });
                ownerEmail = primaryNotifyEmail; // Используем email из email_notify_to
            }
        } else {
            // Fallback: если email_notify_to пустой, используем email из auth.users
            ownerEmail = ownerEmailFromAuth;
            console.log('[notify] email_notify_to is empty, using email from auth.users as fallback:', {
                ownerEmail,
                note: 'Consider adding email_notify_to to use a different email for notifications',
            });
        }

        const title =
            body.type === 'hold'    ? 'Удержание слота' :
                body.type === 'confirm' ? 'Бронь подтверждена' :
                    'Бронь отменена';

        const when = formatInTimeZone(new Date(raw.start_at), TZ, 'dd.MM.yyyy HH:mm');
        const whenEnd = formatInTimeZone(new Date(raw.end_at), TZ, 'HH:mm');
        const created = formatInTimeZone(new Date(raw.created_at), TZ, 'dd.MM.yyyy HH:mm');
        const svcName = svc?.name_ru ?? 'Услуга';
        const svcDuration = svc?.duration_min ?? 0;
        const svcPriceFrom = svc?.price_from;
        const svcPriceTo = svc?.price_to;
        const priceText = svcPriceFrom && svcPriceTo 
            ? (svcPriceFrom === svcPriceTo ? `${svcPriceFrom} сом` : `${svcPriceFrom} - ${svcPriceTo} сом`)
            : svcPriceFrom ? `${svcPriceFrom} сом` : null;
        const master  = staf?.full_name ?? 'Мастер';
        const masterPhone = staf?.phone;
        const bizName = biz?.name ?? 'Бизнес';
        const bizAddress = biz?.address;
        const bizPhones = biz?.phones ?? [];
        const branch = first(raw.branches);
        const branchName = branch?.name;
        const branchAddress = branch?.address;
        const link    = `${origin}/booking/${raw.id}`;
        const statusRuText = statusRu(raw.status);
        
        // Информация о клиенте
        const clientInfo = [];
        if (clientName) clientInfo.push(`Имя: ${clientName}`);
        if (clientPhone) clientInfo.push(`Телефон: ${clientPhone}`);
        if (clientEmail && !raw.client_id) clientInfo.push(`Email: ${clientEmail}`); // Только для гостевых броней
        const clientInfoText = clientInfo.length > 0 ? clientInfo.join(', ') : 'Клиент не указан';

        // HTML + текстовая версия (базовая, без персонализации)
        const baseHtml = `
      <div style="font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.6;color:#1f2937;">
        <h2 style="margin:0 0 16px 0;color:#111827;font-size:20px;">${title}: ${bizName}</h2>
        
        <div style="background:#f9fafb;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Детали бронирования</h3>
          <p style="margin:0 0 8px 0;"><b>Номер брони:</b> <code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;font-size:12px;">${raw.id.slice(0, 8)}</code></p>
          <p style="margin:0 0 8px 0;"><b>Услуга:</b> ${svcName}${svcDuration ? ` (${svcDuration} мин)` : ''}${priceText ? ` — ${priceText}` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>Мастер:</b> ${master}${masterPhone ? ` (${masterPhone})` : ''}</p>
          <p style="margin:0 0 8px 0;"><b>Время:</b> ${when} - ${whenEnd} (${TZ})</p>
          <p style="margin:0 0 8px 0;"><b>Статус:</b> <span style="color:${raw.status === 'confirmed' || raw.status === 'paid' ? '#059669' : raw.status === 'cancelled' ? '#dc2626' : '#f59e0b'};font-weight:600;">${statusRuText}</span></p>
          ${branchName ? `<p style="margin:0 0 8px 0;"><b>Филиал:</b> ${branchName}${branchAddress ? ` — ${branchAddress}` : ''}</p>` : ''}
          ${!branchName && bizAddress ? `<p style="margin:0 0 8px 0;"><b>Адрес:</b> ${bizAddress}</p>` : ''}
          <p style="margin:0 0 0 0;"><b>Создано:</b> ${created}</p>
        </div>
        
        <div style="background:#eff6ff;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Информация о клиенте</h3>
          <p style="margin:0 0 0 0;">${clientInfoText}</p>
        </div>
        
        ${bizPhones.length > 0 ? `
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font-size:16px;color:#111827;">Контакты</h3>
          <p style="margin:0 0 0 0;"><b>Телефоны:</b> ${bizPhones.map(p => `<a href="tel:${p}" style="color:#2563eb;text-decoration:none;">${p}</a>`).join(', ')}</p>
        </div>
        ` : ''}
        
        <div style="margin:16px 0;text-align:center;">
          <a href="${link}" target="_blank" rel="noopener" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Открыть бронь в системе</a>
        </div>
        
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0" />
        <small style="color:#6b7280;font-size:12px;">Письмо отправлено автоматически системой Kezek</small>
      </div>
    `.trim();

        const text =
            `${title}: ${bizName}\n\n` +
            `Детали бронирования:\n` +
            `Номер брони: ${raw.id.slice(0, 8)}\n` +
            `Услуга: ${svcName}${svcDuration ? ` (${svcDuration} мин)` : ''}${priceText ? ` — ${priceText}` : ''}\n` +
            `Мастер: ${master}${masterPhone ? ` (${masterPhone})` : ''}\n` +
            `Время: ${when} - ${whenEnd} (${TZ})\n` +
            `Статус: ${statusRuText}\n` +
            `${branchName ? `Филиал: ${branchName}${branchAddress ? ` — ${branchAddress}` : ''}\n` : ''}` +
            `${!branchName && bizAddress ? `Адрес: ${bizAddress}\n` : ''}` +
            `Создано: ${created}\n\n` +
            `Информация о клиенте:\n` +
            `${clientInfoText}\n\n` +
            `${bizPhones.length > 0 ? `Контакты: ${bizPhones.join(', ')}\n\n` : ''}` +
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
        console.log('[notify] Client email check:', {
            hasClientId: !!raw.client_id,
            hasClientEmail: !!clientEmail,
            clientEmail: clientEmail,
            clientNotifyEmail,
            hasClientName: !!clientName,
            clientName: clientName,
            hasClientPhone: !!clientPhone,
            clientPhone: clientPhone,
            rawClientEmail: (raw as { client_email?: string | null }).client_email,
            rawClientPhone: raw.client_phone,
            rawClientName: raw.client_name,
        });
        if (clientEmail && clientNotifyEmail) {
            recipients.push({ email: clientEmail, name: clientName, role: 'client', withIcs: true });
            console.log('[notify] Added client to recipients:', clientEmail);
        } else if (clientEmail && !clientNotifyEmail) {
            console.log('[notify] Skipping email to client: notifications disabled');
        } else if (!clientEmail) {
            console.log('[notify] Skipping email to client: no email address', {
                hasClientId: !!raw.client_id,
                rawClientEmail: (raw as { client_email?: string | null }).client_email,
            });
        }

        // мастер
        console.log('[notify] Staff email check:', {
            hasEmail: !!staffEmail,
            email: staffEmail,
        });
        if (staffEmail) {
            recipients.push({ email: staffEmail, name: staf?.full_name ?? null, role: 'staff' });
            console.log('[notify] Added staff to recipients:', staffEmail);
        } else {
            console.log('[notify] Skipping email to staff: no email address');
        }

        // владелец
        console.log('[notify] Owner email check:', {
            hasEmail: !!ownerEmail,
            email: ownerEmail,
            owner_id: biz?.owner_id,
            ownerName: ownerName,
        });
        if (ownerEmail) {
            recipients.push({ email: ownerEmail, name: ownerName, role: 'owner' });
            console.log('[notify] Added owner to recipients:', ownerEmail);
        } else {
            console.log('[notify] Skipping email to owner: no email address', {
                owner_id: biz?.owner_id,
                hasBiz: !!biz,
            });
        }

        // администраторы из списка
        // Если первый email из email_notify_to уже используется как ownerEmail, не добавляем его как admin (избегаем дубликата)
        const normalizedAdminEmails = normalizeEmails(adminEmails ?? []);
        const ownerEmailNormalized = ownerEmail ? ownerEmail.toLowerCase().trim() : null;
        for (const em of normalizedAdminEmails) {
            const emNormalized = em.toLowerCase().trim();
            // Пропускаем email, который уже используется как ownerEmail
            if (ownerEmailNormalized && emNormalized === ownerEmailNormalized) {
                console.log('[notify] Skipping admin email (already used as owner):', em);
                continue;
            }
            recipients.push({ email: em, name: null, role: 'admin' });
        }

        // дедуп по email (оставляем первый встретившийся вариант)
        const uniqMap = new Map<string, Recipient>();
        for (const r of recipients) if (!uniqMap.has(r.email)) uniqMap.set(r.email, r);
        const uniqRecipients = Array.from(uniqMap.values());
        
        console.log('[notify] Recipients before dedup:', recipients.length, recipients.map(r => ({ email: r.email, role: r.role })));
        console.log('[notify] Recipients after dedup:', uniqRecipients.length, uniqRecipients.map(r => ({ email: r.email, role: r.role })));

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
        
        // Проверяем, что владелец в списке получателей
        const ownerInRecipients = uniqRecipients.some(r => r.role === 'owner');
        if (!ownerInRecipients && ownerEmail) {
            console.warn('[notify] WARNING: Owner email exists but not in recipients list!', { ownerEmail, owner_id: biz?.owner_id });
        }
        
        let sent = 0;
        console.log('[notify] Starting email sending loop, total recipients:', uniqRecipients.length);
        
        // Resend API ограничивает до 2 запросов в секунду
        // Добавляем задержку между отправками, чтобы избежать rate limiting
        const RESEND_RATE_LIMIT_DELAY_MS = 600; // 600ms между запросами = ~1.67 запросов/сек (безопасно)
        
        for (let i = 0; i < uniqRecipients.length; i++) {
            const rcp = uniqRecipients[i];
            
            // Добавляем задержку перед каждым запросом, кроме первого
            if (i > 0) {
                console.log('[notify] Waiting before sending next email to avoid rate limit...');
                await new Promise(resolve => setTimeout(resolve, RESEND_RATE_LIMIT_DELAY_MS));
            }
            
            console.log('[notify] Sending email to:', rcp.email, 'role:', rcp.role, 'name:', rcp.name, `(${i + 1}/${uniqRecipients.length})`);
            const htmlPersonal = buildHtmlPersonal(baseHtml, rcp.name, rcp.role);
            const payload: Record<string, unknown> = {
                from,
                to: [rcp.email],
                subject: `Kezek: ${title}`,
                html: htmlPersonal,
                text,
            };
            // Добавляем reply_to только если есть email владельца
            if (ownerEmail) {
                payload.reply_to = ownerEmail;
            }
            if (rcp.withIcs) {
                payload.attachments = [{ 
                    filename: 'booking.ics', 
                    content: icsBase64
                }];
            }
            
            // Логируем payload для отладки (без sensitive данных)
            console.log('[notify] Email payload prepared:', {
                to: rcp.email,
                from,
                subject: payload.subject,
                hasHtml: !!payload.html,
                hasText: !!payload.text,
                hasAttachments: !!payload.attachments,
                attachmentsCount: payload.attachments ? (payload.attachments as unknown[]).length : 0,
            });
            
            try {
                const emailResponse = await fetch('https://api.resend.com/emails', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(payload),
                });
                
                if (!emailResponse.ok) {
                    const errorText = await emailResponse.text().catch(() => 'Unknown error');
                    let errorJson: unknown = null;
                    try {
                        errorJson = JSON.parse(errorText);
                    } catch {
                        // Не JSON, используем текст как есть
                    }
                    console.error('[notify] Failed to send email to', rcp.email, 'role:', rcp.role, 'status:', emailResponse.status, 'error:', errorText, 'errorJson:', errorJson);
                    
                    // Если это rate limit ошибка, ждем и пробуем еще раз
                    if (emailResponse.status === 429) {
                        const retryAfter = emailResponse.headers.get('retry-after');
                        const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000; // По умолчанию 2 секунды
                        console.log('[notify] Rate limit hit, waiting', waitTime, 'ms before retry...');
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        
                        // Пробуем еще раз
                        const retryResponse = await fetch('https://api.resend.com/emails', {
                            method: 'POST',
                            headers,
                            body: JSON.stringify(payload),
                        });
                        
                        if (!retryResponse.ok) {
                            const retryErrorText = await retryResponse.text().catch(() => 'Unknown error');
                            console.error('[notify] Retry failed for', rcp.email, 'role:', rcp.role, 'status:', retryResponse.status, 'error:', retryErrorText);
                            // Для владельца логируем более подробно
                            if (rcp.role === 'owner') {
                                console.error('[notify] CRITICAL: Retry failed for owner!', {
                                    email: rcp.email,
                                    owner_id: biz?.owner_id,
                                    status: retryResponse.status,
                                    error: retryErrorText,
                                });
                            }
                        } else {
                            const retryResult = await retryResponse.json().catch(() => ({}));
                            console.log('[notify] Email sent successfully after retry to', rcp.email, 'role:', rcp.role, 'result:', retryResult);
                            if (rcp.role === 'owner') {
                                console.log('[notify] Owner email sent successfully after retry!', {
                                    email: rcp.email,
                                    owner_id: biz?.owner_id,
                                    result: retryResult,
                                });
                            }
                            sent += 1;
                        }
                    } else {
                        // Для владельца логируем более подробно
                        if (rcp.role === 'owner') {
                            console.error('[notify] CRITICAL: Failed to send email to owner!', {
                                email: rcp.email,
                                owner_id: biz?.owner_id,
                                status: emailResponse.status,
                                error: errorText,
                                errorJson,
                                payload: { ...payload, attachments: payload.attachments ? '[present]' : undefined },
                            });
                        }
                    }
                } else {
                    const result = await emailResponse.json().catch(() => ({}));
                    const emailId = (result as { id?: string })?.id || 'unknown';
                    console.log('[notify] Email sent successfully to', rcp.email, 'role:', rcp.role, 'result:', result);
                    console.log('[notify] Resend email ID:', emailId, '- Check delivery status in Resend Dashboard');
                    
                    // Проверяем статус доставки через Resend API (опционально, для отладки)
                    if (emailId && emailId !== 'unknown' && rcp.role === 'owner') {
                        try {
                            // Небольшая задержка перед проверкой статуса
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const statusResponse = await fetch(`https://api.resend.com/emails/${emailId}`, {
                                method: 'GET',
                                headers: {
                                    'Authorization': `Bearer ${apiKey}`,
                                },
                            });
                            if (statusResponse.ok) {
                                const statusData = await statusResponse.json().catch(() => ({}));
                                console.log('[notify] Owner email delivery status:', {
                                    emailId,
                                    status: (statusData as { last_event?: string })?.last_event || 'unknown',
                                    fullStatus: statusData,
                                });
                            }
                        } catch (statusError) {
                            // Игнорируем ошибки проверки статуса - это не критично
                            console.log('[notify] Could not check email delivery status:', statusError);
                        }
                    }
                    
                    // Для владельца логируем более подробно
                    if (rcp.role === 'owner') {
                        console.log('[notify] Owner email sent successfully!', {
                            email: rcp.email,
                            owner_id: biz?.owner_id,
                            emailId,
                            result,
                            note: 'Check Resend Dashboard for delivery status. Email may be in spam folder. Verify domain SPF/DKIM records.',
                            resendDashboardUrl: `https://resend.com/emails/${emailId}`,
                        });
                    }
                    sent += 1;
                }
            } catch (fetchError) {
                const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
                console.error('[notify] Exception while sending email to', rcp.email, 'role:', rcp.role, 'error:', errorMsg);
                // Для владельца логируем более подробно
                if (rcp.role === 'owner') {
                    console.error('[notify] CRITICAL: Exception sending email to owner!', {
                        email: rcp.email,
                        owner_id: biz?.owner_id,
                        error: errorMsg,
                    });
                }
            }
        }

        // SMS уведомления отключены - используем только Email и WhatsApp

        // --- отправляем WhatsApp и Telegram уведомления
        const whatsappText = `${title}: ${bizName}\n\nУслуга: ${svcName}\nМастер: ${master}\nВремя: ${when}\nСтатус: ${statusRuText}\n\n${link}`;
        const telegramText = `${title}: <b>${bizName}</b>\n\n` +
            `<b>Услуга:</b> ${svcName}\n` +
            `<b>Мастер:</b> ${master}\n` +
            `<b>Время:</b> ${when} (${TZ})\n` +
            `<b>Статус:</b> ${statusRuText}\n\n` +
            `<a href="${link}">Открыть бронь</a>`;
        let whatsappSent = 0;
        let telegramSent = 0;

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

        // --- Telegram клиенту (если подключен и включены настройки)
        const hasTelegramConfig = !!process.env.TELEGRAM_BOT_TOKEN;
        if (!hasTelegramConfig) {
            console.warn('[notify] Telegram not configured: missing TELEGRAM_BOT_TOKEN');
        }

        if (clientTelegramId && hasTelegramConfig && clientNotifyTelegram && clientTelegramVerified) {
            try {
                console.log('[notify] Sending Telegram to client:', clientTelegramId);
                await sendTelegram({ chatId: clientTelegramId, text: telegramText });
                telegramSent += 1;
                console.log('[notify] Telegram to client sent successfully');
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] Telegram to client failed:', errorMsg, { chatId: clientTelegramId });
            }
        } else if (clientTelegramId && !clientNotifyTelegram) {
            console.log('[notify] Skipping Telegram to client: notifications disabled');
        } else if (clientTelegramId && !clientTelegramVerified) {
            console.log('[notify] Skipping Telegram to client: telegram not verified');
        } else if (!clientTelegramId) {
            console.log('[notify] No client telegram_id for Telegram');
        }

        // --- Telegram мастеру (если подключен и включены настройки)
        // Для мастера отправляем уведомление даже если telegram не верифицирован (для служебных уведомлений это допустимо)
        console.log('[notify] Staff Telegram check:', {
            hasTelegramId: !!staffTelegramId,
            telegramId: staffTelegramId,
            hasTelegramConfig,
            staffNotifyTelegram,
            staffTelegramVerified,
        });
        if (staffTelegramId && hasTelegramConfig && staffNotifyTelegram) {
            try {
                console.log('[notify] Sending Telegram to staff:', staffTelegramId, '(verified:', staffTelegramVerified, ')');
                await sendTelegram({ chatId: staffTelegramId, text: telegramText });
                telegramSent += 1;
                console.log('[notify] Telegram to staff sent successfully');
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] Telegram to staff failed:', errorMsg, { chatId: staffTelegramId });
            }
        } else if (staffTelegramId && !staffNotifyTelegram) {
            console.log('[notify] Skipping Telegram to staff: notifications disabled');
        } else if (!staffTelegramId) {
            console.log('[notify] No staff telegram_id for Telegram');
        } else if (!hasTelegramConfig) {
            console.log('[notify] Telegram not configured: missing TELEGRAM_BOT_TOKEN');
        }

        // --- Telegram владельцу (если подключен и включены настройки)
        // Для владельца отправляем уведомление даже если telegram не верифицирован (для служебных уведомлений это допустимо)
        console.log('[notify] Owner Telegram check:', {
            hasTelegramId: !!ownerTelegramId,
            telegramId: ownerTelegramId,
            hasTelegramConfig,
            ownerNotifyTelegram,
            ownerTelegramVerified,
        });
        if (ownerTelegramId && hasTelegramConfig && ownerNotifyTelegram) {
            try {
                console.log('[notify] Sending Telegram to owner:', ownerTelegramId, '(verified:', ownerTelegramVerified, ')');
                await sendTelegram({ chatId: ownerTelegramId, text: telegramText });
                telegramSent += 1;
                console.log('[notify] Telegram to owner sent successfully');
            } catch (e) {
                const errorMsg = e instanceof Error ? e.message : String(e);
                console.error('[notify] Telegram to owner failed:', errorMsg, { chatId: ownerTelegramId });
            }
        } else if (ownerTelegramId && !ownerNotifyTelegram) {
            console.log('[notify] Skipping Telegram to owner: notifications disabled');
        } else if (!ownerTelegramId) {
            console.log('[notify] No owner telegram_id for Telegram');
        } else if (!hasTelegramConfig) {
            console.log('[notify] Telegram not configured: missing TELEGRAM_BOT_TOKEN');
        }

        console.log('[notify] ===== NOTIFY ENDPOINT COMPLETED =====', { sent, whatsappSent, telegramSent });
        return NextResponse.json({ ok: true, sent, whatsappSent, telegramSent });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        const stack = e instanceof Error ? e.stack : undefined;
        console.error('[notify] ===== NOTIFY ENDPOINT ERROR =====');
        console.error('[notify] error message:', msg);
        console.error('[notify] error stack:', stack);
        console.error('[notify] full error:', e);
        return createErrorResponse('internal', msg, undefined, 500);
    }
}
