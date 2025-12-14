export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import {getBizContextForManagers} from '@/lib/authBiz';
import { formatErrorSimple } from '@/lib/errors';
import {getServiceClient} from '@/lib/supabaseService';

type Body = {
    full_name: string;
    email?: string | null;
    phone?: string | null;
    branch_id: string;
    is_active: boolean;
};

export async function POST(req: Request, context: unknown) {
    // безопасно достаём params.id без any
    const params =
        typeof context === 'object' &&
        context !== null &&
        'params' in context
            ? (context as { params: Record<string, string | string[]> }).params
            : {};
    try {
        const {supabase, userId, bizId} = await getBizContextForManagers();

        const {data: roles} = await supabase
            .from('user_roles')
            .select('roles!inner(key)')
            .eq('user_id', userId)
            .eq('biz_id', bizId);

        const ok = (roles ?? []).some(r => {
            if (!r || typeof r !== 'object' || !('roles' in r)) return false;
            const roleObj = (r as { roles?: { key?: unknown } | null }).roles;
            if (!roleObj || typeof roleObj !== 'object' || !('key' in roleObj)) return false;
            const key = roleObj.key;
            return typeof key === 'string' && ['owner', 'admin', 'manager'].includes(key);
        });
        if (!ok) return NextResponse.json({ok: false, error: 'FORBIDDEN'}, {status: 403});

        const body = (await req.json()) as Body;
        if (!body.full_name || !body.branch_id) {
            return NextResponse.json({ok: false, error: 'INVALID_BODY'}, {status: 400});
        }

        // Используем service client для поиска пользователя и добавления роли
        const admin = getServiceClient();
        let linkedUserId: string | null = null;

        // Пытаемся найти существующего пользователя по email или phone
        if (body.email || body.phone) {
            const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const foundUser = userList?.users?.find(u => {
                if (body.email && u.email === body.email) return true;
                if (body.phone && u.phone === body.phone) return true;
                return false;
            });
            if (foundUser) {
                linkedUserId = foundUser.id;
            }
        }

        const {error} = await supabase
            .from('staff')
            .update({
                full_name: body.full_name,
                email: body.email ?? null,
                phone: body.phone ?? null,
                branch_id: body.branch_id,
                is_active: body.is_active,
                user_id: linkedUserId,
            })
            .eq('id', params.id)
            .eq('biz_id', bizId);

        if (error) return NextResponse.json({ok: false, error: error.message}, {status: 400});

        // Если нашли пользователя и привязали, добавляем роль staff
        if (linkedUserId) {
            const { data: roleStaff } = await admin
                .from('roles')
                .select('id')
                .eq('key', 'staff')
                .maybeSingle();
            
            if (roleStaff?.id) {
                // Проверяем, нет ли уже такой роли
                const { data: existsRole } = await admin
                    .from('user_roles')
                    .select('id')
                    .eq('user_id', linkedUserId)
                    .eq('role_id', roleStaff.id)
                    .eq('biz_id', bizId)
                    .maybeSingle();

                if (!existsRole) {
                    const { error: eRole } = await admin
                        .from('user_roles')
                        .insert({
                            user_id: linkedUserId,
                            biz_id: bizId,
                            role_id: roleStaff.id,
                            biz_key: bizId,
                        });
                    if (eRole) {
                        console.warn('Failed to add staff role:', eRole.message);
                        // Не возвращаем ошибку, т.к. сотрудник уже обновлен
                    }
                }
            }
        }

        return NextResponse.json({ok: true, user_linked: !!linkedUserId});
    } catch (e: unknown) {
        return NextResponse.json({ok: false, error: formatErrorSimple(e) || 'UNKNOWN'}, {status: 500});
    }
}
