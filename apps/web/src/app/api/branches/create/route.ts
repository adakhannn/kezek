export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';
import { coordsToEWKT, validateLatLon } from '@/lib/validation';

type Body = {
    name: string;
    address?: string | null;
    is_active?: boolean;
    lat?: number | null;
    lon?: number | null;
};

export async function POST(req: Request) {
    try {
        const { supabase, bizId } = await getBizContextForManagers();
        
        // Проверяем, является ли пользователь суперадмином
        const { data: isSuper } = await supabase.rpc('is_super_admin');
        if (!isSuper) {
            return NextResponse.json({ ok: false, error: 'FORBIDDEN', message: 'Только суперадмин может создавать филиалы' }, { status: 403 });
        }
        
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) {
            return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
        }

        let coordsWkt: string | null = null;
        if (body.lat != null && body.lon != null) {
            const v = validateLatLon(body.lat, body.lon);
            if (!v.ok) {
                return NextResponse.json({ ok: false, error: 'Некорректные координаты' }, { status: 400 });
            }
            coordsWkt = coordsToEWKT(v.lat, v.lon);
        }

        const { data, error } = await admin
            .from('branches')
            .insert({
                biz_id: bizId,
                name: body.name.trim(),
                address: body.address ?? null,
                is_active: body.is_active ?? true,
                coords: coordsWkt,
            })
            .select('id')
            .single();

        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

        return NextResponse.json({ ok: true, id: data?.id });
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
}
