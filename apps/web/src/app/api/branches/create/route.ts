export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
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
    // Применяем rate limiting для создания филиала (админская операция)
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        () => withErrorHandler('BranchesCreate', async () => {
        const { supabase, bizId } = await getBizContextForManagers();
        
        // Проверяем, является ли пользователь суперадмином
        const { data: isSuper } = await supabase.rpc('is_super_admin');
        if (!isSuper) {
            return createErrorResponse('forbidden', 'Только суперадмин может создавать филиалы', undefined, 403);
        }
        
        const admin = getServiceClient();

        const body = await req.json().catch(() => ({} as Body));
        if (!body.name?.trim()) {
            return createErrorResponse('validation', 'Название филиала обязательно', undefined, 400);
        }

        let coordsWkt: string | null = null;
        if (body.lat != null && body.lon != null) {
            const v = validateLatLon(body.lat, body.lon);
            if (!v.ok) {
                return createErrorResponse('validation', 'Некорректные координаты', undefined, 400);
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

        if (error) {
            return createErrorResponse('validation', error.message, undefined, 400);
        }

        return createSuccessResponse({ id: data?.id });
        })
    );
}
