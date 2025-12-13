export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';
import { coordsToEWKT, validateLatLon } from '@/lib/validation';

type Body = {
    name: string;
    address?: string | null;
    is_active: boolean;
    lat?: number | null;
    lon?: number | null;
};

export async function POST(req: Request, context: unknown) {
    try {
        const branchId = await getRouteParamRequired(context, 'id');
        const { bizId } = await getBizContextForManagers();
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });

        // проверим, что филиал принадлежит этому бизнесу
        const { data: br, error: brError } = await admin
            .from('branches')
            .select('id,biz_id')
            .eq('id', branchId)
            .maybeSingle();

        if (brError) {
            return NextResponse.json({ ok: false, error: `Ошибка проверки филиала: ${brError.message}` }, { status: 400 });
        }

        if (!br) {
            return NextResponse.json({ ok: false, error: 'Филиал не найден' }, { status: 404 });
        }

        if (String(br.biz_id) !== String(bizId)) {
            return NextResponse.json({ 
                ok: false, 
                error: 'BRANCH_NOT_IN_THIS_BUSINESS',
                details: { branchBizId: br.biz_id, currentBizId: bizId }
            }, { status: 403 });
        }

        const updateData: {
            name: string;
            address: string | null;
            is_active: boolean;
            coords?: string | null;
        } = {
            name: body.name.trim(),
            address: body.address ?? null,
            is_active: !!body.is_active,
        };

        // Координаты: меняем ТОЛЬКО coords; lat/lon не трогаем (их пересчитает БД)
        if ('lat' in body || 'lon' in body) {
            if (body.lat != null && body.lon != null) {
                const v = validateLatLon(body.lat, body.lon);
                if (!v.ok) {
                    return NextResponse.json({ ok: false, error: 'Некорректные координаты' }, { status: 400 });
                }
                updateData.coords = coordsToEWKT(v.lat, v.lon);
            } else {
                updateData.coords = null;
            }
        }

        const { error: eUpd } = await admin
            .from('branches')
            .update(updateData)
            .eq('id', branchId)
            .eq('biz_id', bizId);

        if (eUpd) return NextResponse.json({ ok: false, error: eUpd.message }, { status: 400 });

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
