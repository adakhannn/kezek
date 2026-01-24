// apps/web/src/app/api/admin/performance/stats/route.ts
import { NextResponse } from 'next/server';

import { getPerformanceStats, getOperations } from '@/lib/performance';
import { getServiceClient } from '@/lib/supabaseService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/performance/stats
 * Возвращает статистику производительности для всех операций
 */
export async function GET(req: Request) {
    try {
        // Проверяем, что пользователь - супер-админ
        const supabase = getServiceClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Проверяем, является ли пользователь супер-админом
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_super_admin')
            .eq('id', user.id)
            .maybeSingle();

        if (!profile?.is_super_admin) {
            return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
        }

        // Получаем список всех операций
        const operations = getOperations();

        // Получаем статистику для каждой операции за последние 5 минут
        const stats = operations.map((operation) => ({
            operation,
            ...getPerformanceStats(operation, 5 * 60 * 1000), // 5 минут
        }));

        return NextResponse.json({
            ok: true,
            stats,
            timestamp: Date.now(),
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
}

