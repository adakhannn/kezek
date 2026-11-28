// apps/web/src/app/admin/api/users/list/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';
import { parseAdminUserPage } from '@/lib/adminUserStats';
import { reportDatabaseError } from '@/lib/apiErrorHandler';
import { logError } from '@/lib/log';
import { readPlatformAdminStates } from '@/lib/platformAdminState';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { validateQuery } from '@/lib/validation/apiValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

        // 1) Проверка прав (текущий запрос выполняется от имени пользователя по anon-cookie)
        const supa = await createSupabaseServerClient();

        const { data: meData, error: authError } = await supa.auth.getUser();
        if (authError || !meData?.user) {
            return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' } satisfies ListErr, { status: 401 });
        }

        // доступ только глобальному супер-админу
        const { isSuperAdmin: superRow, error: superErr } = await checkCurrentUserIsSuperAdmin(supa, meData.user.id);
        if (superErr) return NextResponse.json({ ok: false, error: reportDatabaseError('AdminUsersList', superErr) } satisfies ListErr, { status: 400 });
        if (!superRow) return NextResponse.json({ ok: false, error: 'FORBIDDEN' } satisfies ListErr, { status: 403 });

        // 2) Админ-клиент (service role)
        const admin = createSupabaseAdminClient();

        // 3) Поиск, фильтр, порядок, страница и честный total — в одной серверной выборке по всему
        // каталогу (ARCH-03): прежде фильтровалась одна страница listUsers.
        const { data: pageData, error: pageError } = await admin.rpc('admin_list_users', {
            p_actor_id: meData.user.id,
            p_q: q || undefined,
            p_status: status,
            p_limit: perPage,
            p_offset: (page - 1) * perPage,
        });
        if (pageError) {
            logError('AdminUsersList', 'admin_list_users failed', pageError);
            return NextResponse.json({ ok: false, error: 'users_unavailable' } satisfies ListErr, { status: 500 });
        }
        const directory = parseAdminUserPage(pageData);

        // 4) Флаг супера — каноническим чтением для строк этой страницы
        const superStates = await readPlatformAdminStates(admin, meData.user.id, directory.items.map((item) => item.id));
        const items: UserListItem[] = directory.items.map((item) => ({ ...item, is_super: superStates.get(item.id) === true }));

        const payload: ListOk = {
            ok: true,
            items,
            page,
            perPage,
            total: directory.total,
        };

        return NextResponse.json(payload);
    } catch (e: unknown) {
        logError('AdminUsersList', 'Unexpected error', e);
        return NextResponse.json({ ok: false, error: 'users_unavailable' } satisfies ListErr, { status: 500 });
    }
}
