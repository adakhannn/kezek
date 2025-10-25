export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

/**
 * POST /api/users/search
 * Body: { q?: string, page?: number, perPage?: number }
 * Возвращает: { ok: true, items: [{ id, email, phone, full_name }], page, perPage, total? }
 *
 * Поведение:
 * - если q пустая → вернёт первую страницу пользователей (по умолчанию 50).
 * - если q задана → вернёт пользователей, у кого email/phone/имя содержит q.
 */
export async function POST(req: Request) {
    try {
        // Доступ сюда уже ограничен getBizContextForManagers (owner/admin/manager ИЛИ владелец по owner_id)
        await getBizContextForManagers();

        const { q, page = 1, perPage = 50 } = await req.json().catch(() => ({}));
        const query = (q ?? '').trim().toLowerCase();

        const admin = getServiceClient();
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage });

        if (error) {
            return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
        }

        const users = data.users ?? [];

        // маппинг и фильтрация
        const mapped = users.map(u => {
            const meta = (u.user_metadata ?? {});
            return {
                id: u.id,
                email: u.email ?? null,
                phone: u.phone ?? null,
                full_name: meta.full_name ?? meta.fullName ?? u.email ?? 'Без имени',
            };
        });

        const items = query
            ? mapped.filter(u =>
                (u.email ?? '').toLowerCase().includes(query) ||
                (u.phone ?? '').includes(query) ||
                (u.full_name ?? '').toLowerCase().includes(query),
            )
            : mapped;

        return NextResponse.json({ ok: true, items, page, perPage });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e?.message ?? 'UNKNOWN' }, { status: 500 });
    }
}
