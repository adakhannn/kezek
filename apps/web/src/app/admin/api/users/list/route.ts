// apps/web/src/app/admin/api/users/list/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseServiceRoleKey } from '@/lib/env';
import { validateQuery } from '@/lib/validation/apiValidation';

const userListQuerySchema = z.object({
    q: z
        .string()
        .optional()
        .transform((value) => (value ?? '').trim().toLowerCase()),
    page: z.coerce.number().int().min(1).max(1000).optional().default(1),
    perPage: z.coerce.number().int().min(1).max(200).optional().default(50),
    status: z.enum(['all', 'active', 'blocked']).optional().default('all'),
});

type UserListItem = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    last_sign_in_at: string | null;
    is_super: boolean;
    is_blocked: boolean;
    block_reason?: string | null;
};

type ListOk = {
    ok: true;
    items: UserListItem[];
    page: number;
    perPage: number;
    total: number;
};

type ListErr = { ok: false; error?: string };

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const queryValidation = validateQuery(url, userListQuerySchema);
        if (!queryValidation.success) {
            return queryValidation.response;
        }
        const { q, page, perPage, status } = queryValidation.data;

        const SB_URL = getSupabaseUrl();
        const SB_ANON = getSupabaseAnonKey();
        const SB_SERVICE = getSupabaseServiceRoleKey();

        // 1) Проверка прав (текущий запрос выполняется от имени пользователя по anon-cookie)
        const cookieStore = await cookies();
        const supa = createServerClient(SB_URL, SB_ANON, {
            cookies: { get: (n: string) => cookieStore.get(n)?.value, set: () => {}, remove: () => {} },
        });

        const { data: meData } = await supa.auth.getUser();
        if (!meData?.user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' } satisfies ListErr, { status: 401 });
        }

        // доступ только глобальному супер-админу
        const { data: superRow, error: superErr } = await supa
            .from('user_roles_with_user')
            .select('role_key,biz_id')
            .eq('role_key', 'super_admin')
            .is('biz_id', null)
            .limit(1)
            .maybeSingle();
        if (superErr) return NextResponse.json({ ok: false, error: superErr.message } satisfies ListErr, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'FORBIDDEN' } satisfies ListErr, { status: 403 });

        // 2) Админ-клиент (service role)
        const admin = createClient(SB_URL, SB_SERVICE);

        // Supabase Admin API не принимает offset/limit напрямую, но принимает "page" и "perPage"
        // поэтому считаем page/perPage как есть:
        const listResp = await (admin).auth.admin.listUsers({
            page,
            perPage,
        });
        if (listResp.error) {
            return NextResponse.json({ ok: false, error: listResp.error.message } satisfies ListErr, { status: 400 });
        }

        const users = listResp?.data?.users ?? [];

        // 4) Подтягиваем profile.full_name
        const ids = users.map((u) => u.id) as string[];
        const profiles: Record<string, { full_name: string | null }> = {};
        if (ids.length > 0) {
            const { data: profRows } = await admin
                .from('profiles')
                .select('id,full_name')
                .in('id', ids);
            for (const r of profRows ?? []) {
                profiles[r.id] = { full_name: r.full_name };
            }
        }

        // 5) Флаг супера
        const superIds = new Set<string>();
        if (ids.length > 0) {
            const { data: supers } = await admin
                .from('user_roles_with_user')
                .select('user_id')
                .in('user_id', ids)
                .eq('role_key', 'super_admin')
                .is('biz_id', null);
            for (const r of supers ?? []) superIds.add(r.user_id);
        }

        // 6) Флаг "заблокирован" (+ причина)
        const blockedMap = new Map<string, { reason: string | null }>();
        if (ids.length > 0) {
            const { data: blocks } = await admin
                .from('user_suspensions')
                .select('user_id,reason')
                .in('user_id', ids);
            for (const b of blocks ?? []) blockedMap.set(b.user_id, { reason: b.reason ?? null });
        }

        // 7) Формируем список и применяем поиск/фильтр
        let items: UserListItem[] = users.map((u) => {
            const full_name = profiles[u.id]?.full_name ?? (u.user_metadata?.full_name ?? null);
            const is_super = superIds.has(u.id);
            const blk = blockedMap.get(u.id);
            return {
                id: u.id,
                full_name,
                email: u.email ?? null,
                phone: (u).phone ?? null,
                last_sign_in_at: u.last_sign_in_at ?? null,
                is_super,
                is_blocked: !!blk,
                block_reason: blk?.reason ?? null,
            };
        });

        // поиск: по email/phone/full_name/id (кейс-инсensitive)
        if (q) {
            const ql = q.toLowerCase();
            items = items.filter((it) => {
                return (
                    (it.email ?? '').toLowerCase().includes(ql) ||
                    (it.phone ?? '').toLowerCase().includes(ql) ||
                    (it.full_name ?? '').toLowerCase().includes(ql) ||
                    it.id.toLowerCase().includes(ql)
                );
            });
        }

        // фильтр статуса
        if (status === 'active') {
            items = items.filter((it) => !it.is_blocked);
        } else if (status === 'blocked') {
            items = items.filter((it) => it.is_blocked);
        }

        // ВАЖНО: listUsers уже вернул ровно perPage, но после фильтра/поиска может стать меньше.
        // Для корректной пагинации можно пересчитывать total по всем страницам,
        // но это дороговато; сделаем pragmatic: total = (page-1)*perPage + items.length, если это последняя выборка.
        // Проще: вернём total неизвестным образом — но для UI достаточно показать текущую страницу.
        // Если хочешь точный total с поиском/статусом — можно добавить серверное индексированное представление.
        const payload: ListOk = {
            ok: true,
            items,
            page,
            perPage,
            total: (page - 1) * perPage + items.length,
        };

        return NextResponse.json(payload);
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
