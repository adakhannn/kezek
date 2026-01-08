// apps/web/src/app/api/services/create/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

type Body = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
    duration_min: number;
    price_from: number;
    price_to: number;
    active?: boolean;
    // было:
    // branch_id: string;
    // стало:
    branch_ids?: string[];      // мультивыбор (обязательно)
    branch_id?: string | null;  // на всякий — поддержим старый клиент
};

export async function POST(req: Request) {
    try {
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = (await req.json().catch(() => ({}))) as Body;

        // ---- валидация базовых полей
        const name = (body.name_ru ?? '').trim();
        if (!name) return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });

        const duration = Number(body.duration_min) || 0;
        if (duration <= 0)
            return NextResponse.json({ ok: false, error: 'DURATION_INVALID' }, { status: 400 });

        const price_from = Number(body.price_from) || 0;
        const price_to = Number(body.price_to) || 0;
        if (price_to && price_from && price_to < price_from)
            return NextResponse.json({ ok: false, error: 'PRICE_RANGE_INVALID' }, { status: 400 });

        // ---- собираем список филиалов
        let branchIds = Array.isArray(body.branch_ids) ? body.branch_ids.filter(Boolean) : [];

        // обратная совместимость со старым клиентом (один филиал)
        if (!branchIds.length && body.branch_id) branchIds = [body.branch_id];

        // чистим дубликаты
        branchIds = Array.from(new Set(branchIds));

        if (branchIds.length === 0)
            return NextResponse.json({ ok: false, error: 'BRANCHES_REQUIRED' }, { status: 400 });

        // на всякий ограничим пачку
        if (branchIds.length > 100)
            return NextResponse.json({ ok: false, error: 'TOO_MANY_BRANCHES' }, { status: 400 });

        // ---- проверим, что ВСЕ указанные филиалы принадлежат этому бизнесу
        const { data: brRows, error: brErr } = await admin
            .from('branches')
            .select('id')
            .eq('biz_id', bizId)
            .in('id', branchIds);

        if (brErr)
            return NextResponse.json({ ok: false, error: brErr.message }, { status: 400 });

        const found = new Set((brRows ?? []).map((r) => String(r.id)));
        const missing = branchIds.filter((id) => !found.has(String(id)));
        if (missing.length) {
            return NextResponse.json(
                { ok: false, error: 'BRANCH_NOT_IN_THIS_BUSINESS', details: { missing } },
                { status: 400 }
            );
        }

        // ---- готовим мульти-вставку
        const active = body.active ?? true;
        const name_ky = body.name_ky?.trim() || null;
        const name_en = body.name_en?.trim() || null;
        const rows = branchIds.map((branch_id) => ({
            biz_id: bizId,
            branch_id,
            name_ru: name,
            name_ky,
            name_en,
            duration_min: duration,
            price_from,
            price_to,
            active,
        }));

        const { data: inserted, error: insErr } = await admin
            .from('services')
            .insert(rows)
            .select('id, branch_id');

        if (insErr)
            return NextResponse.json({ ok: false, error: insErr.message }, { status: 400 });

        return NextResponse.json({
            ok: true,
            count: inserted?.length ?? 0,
            ids: (inserted ?? []).map((r) => r.id),
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ ok: false, error: msg }, { status: 500 });
    }
}
