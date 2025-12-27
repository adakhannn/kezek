export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type AdminClient = SupabaseClient;

type Body = {
    biz_id?: string;
    branch_id?: string;
    service_id?: string;
    staff_id?: string;
    start_at?: string; // ISO с таймзоной
    duration_min?: number;
    client_name?: string | null;
    client_phone?: string | null;
    client_email?: string | null;
};

function normStr(v?: string | null): string | null {
    const s = (v ?? '').trim();
    return s.length ? s : null;
}

// Поиск пользователя по телефону через Admin API
async function findUserIdByPhone(
    admin: AdminClient,
    phone: string
): Promise<string | null> {
    // Пробуем найти через view user_roles_with_user (быстрее, если пользователь уже есть в системе)
    try {
        const { data: found, error } = await admin
            .from('user_roles_with_user')
            .select('user_id')
            .eq('phone', phone)
            .limit(1)
            .maybeSingle();
        
        if (!error && found?.user_id) {
            return found.user_id as string;
        }
    } catch {
        // Игнорируем ошибки, переходим к пагинации
    }
    
    // Если не нашли через view, ищем через пагинацию auth.users
    const api = admin.auth.admin as {
        listUsers: (args: { page?: number; perPage?: number }) => Promise<{
            data: {
                users: Array<{ id: string; phone?: string | null; user_metadata?: unknown }>
            } | null;
            error: { message: string } | null;
        }>;
    };
    
    for (let page = 1; page <= 10; page++) {
        const { data, error } = await api.listUsers({ page, perPage: 1000 });
        if (error) break;
        
        const users = data?.users ?? [];
        const found = users.find((u) => {
            const byPhone = u.phone === phone;
            const meta = (u.user_metadata && typeof u.user_metadata === 'object'
                ? (u.user_metadata as { phone?: string })
                : {}) as { phone?: string };
            const metaPhone = meta.phone;
            return byPhone || metaPhone === phone;
        });
        
        if (found) return found.id;
        if (users.length < 1000) break; // последняя страница
    }
    
    return null;
}

// Создание пользователя с телефоном (без пароля, для OTP входа)
async function createUserByPhone(
    admin: AdminClient,
    phone: string,
    fullName?: string | null,
    email?: string | null
): Promise<string> {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
        phone,
        phone_confirm: true,
        email: email || undefined,
        email_confirm: email ? true : undefined,
        user_metadata: fullName ? { full_name: fullName, phone } : { phone },
    });
    
    if (createErr) {
        // Если пользователь уже существует, пытаемся найти его
        if (/already registered/i.test(createErr.message)) {
            const found = await findUserIdByPhone(admin, phone);
            if (found) return found;
        }
        throw new Error(createErr.message);
    }
    
    if (!created?.user?.id) {
        throw new Error('Failed to create user');
    }
    
    const userId = created.user.id;
    
    // Обновляем профиль с именем и email, если указано
    const profileData: { id: string; full_name?: string; email?: string } = { id: userId };
    if (fullName) profileData.full_name = fullName;
    if (email) profileData.email = email;
    
    if (fullName || email) {
        await admin.from('profiles').upsert(profileData, { onConflict: 'id' });
    }
    
    return userId;
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
        const client_email = normStr(raw.client_email ?? null);

        if (!biz_id || !branch_id || !service_id || !staff_id || !start_at || !duration_min) {
            return NextResponse.json(
                { ok: false, error: 'missing_fields', message: 'Не хватает данных для записи' },
                { status: 400 }
            );
        }

        if (!client_name && !client_phone && !client_email) {
            return NextResponse.json(
                { ok: false, error: 'missing_client', message: 'Укажите имя, телефон или email' },
                { status: 400 }
            );
        }

        // Ищем или создаем пользователя по телефону или email
        let client_id: string | null = null;
        if (client_phone) {
            try {
                // Сначала пытаемся найти существующего пользователя по телефону
                client_id = await findUserIdByPhone(admin, client_phone);
                
                // Если не нашли - создаем нового
                if (!client_id) {
                    client_id = await createUserByPhone(admin, client_phone, client_name, client_email);
                } else {
                    // Если пользователь найден - обновляем профиль с именем и email, если указано
                    const profileData: { id: string; full_name?: string; email?: string } = { id: client_id };
                    if (client_name) profileData.full_name = client_name;
                    if (client_email) profileData.email = client_email;
                    
                    if (client_name || client_email) {
                        await admin.from('profiles').upsert(profileData, { onConflict: 'id' });
                    }
                }
            } catch (e) {
                console.error('Error finding/creating user by phone:', e);
                // Продолжаем без client_id - запись будет создана с client_name и client_phone
            }
        } else if (client_email) {
            // Если нет телефона, но есть email - можно попробовать найти по email
            // (но создавать пользователя без телефона не будем, так как нужен телефон для OTP)
            // Просто сохраним email в профиле, если пользователь будет найден позже
        }

        const { data, error } = await admin.rpc('create_internal_booking', {
            p_biz_id: biz_id,
            p_branch_id: branch_id,
            p_service_id: service_id,
            p_staff_id: staff_id,
            p_start: start_at,
            p_minutes: duration_min,
            p_client_id: client_id,
            p_client_name: client_name,
            p_client_phone: client_phone,
        });

        if (error) {
            const msg = (error as { message?: string }).message ?? 'RPC error';
            // Улучшаем сообщение об ошибке для пользователя
            let userMessage = msg;
            if (msg.includes('no_overlap') || msg.includes('exclusion constraint')) {
                userMessage = 'Этот слот уже занят. Пожалуйста, выберите другое время.';
            } else if (msg.includes('is not assigned to branch')) {
                userMessage = 'На выбранную дату мастер не прикреплён к этому филиалу. Попробуйте выбрать другой день или мастера.';
            }
            return NextResponse.json({ ok: false, error: 'rpc', message: userMessage }, { status: 400 });
        }

        const bookingId = String(data);

        // Обновляем email в брони, если указан (RPC может не поддерживать p_client_email)
        if (client_email) {
            try {
                await admin
                    .from('bookings')
                    .update({ client_email })
                    .eq('id', bookingId);
            } catch (e) {
                console.error('Failed to update client_email in booking:', e);
                // Не критично, продолжаем
            }
        }

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


