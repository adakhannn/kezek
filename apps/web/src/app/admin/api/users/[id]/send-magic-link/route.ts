// apps/web/src/app/admin/api/users/[id]/send-magic-link/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {NextResponse} from 'next/server';

import { DATABASE_FAILURE_MESSAGES, publicErrorMessage, reportDatabaseError } from '@/lib/apiErrorHandler';
import { getSiteOrigin } from '@/lib/env';
import {logError} from '@/lib/log';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withLocalizedMessages } from '@/lib/serverMessages';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export const POST = withLocalizedMessages(async function POST(_req: Request, context: unknown) {
    // Next.js 15+ passes params as a Promise; reading it synchronously yielded undefined.
    let userId: string;
    try {
        userId = await getRouteParamUuid(context, 'id');
    } catch {
        return NextResponse.json({ok: false, error: 'bad user id'}, {status: 400});
    }
    try {
        const SITE = getSiteOrigin();

        // Проверяем, что вызвавший — супер-админ
        const supa = await createSupabaseServerClient();

        const {
            data: {user},
        } = await supa.auth.getUser();
        if (!user) return NextResponse.json({ok: false, error: 'auth'}, {status: 401});

        const {data: isSuper, error: eSuper} = await supa.rpc('is_super_admin');
        if (eSuper) return NextResponse.json({ok: false, error: reportDatabaseError('SendMagicLink', eSuper)}, {status: 400});
        if (!isSuper) return NextResponse.json({ok: false, error: 'forbidden'}, {status: 403});

        // Admin client (service role)
        const admin = createSupabaseAdminClient();

        // Берём email пользователя
        const {data: userResp, error: eGet} = await admin.auth.admin.getUserById(userId);
        if (eGet) return NextResponse.json({ok: false, error: reportDatabaseError('SendMagicLink', eGet, DATABASE_FAILURE_MESSAGES.save)}, {status: 400});

        const email = userResp?.user?.email ?? null;
        if (!email) {
            return NextResponse.json({ok: false, error: 'У пользователя нет email'}, {status: 400});
        }

        // generateLink только создаёт ссылку: письмо не отправляется, ссылка
        // возвращается супер-админу и даёт вход под этим пользователем.
        const {data: linkData, error: eGen} = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
            options: {redirectTo: `${SITE}/auth/callback?next=/admin`},
        });
        if (eGen) return NextResponse.json({ok: false, error: reportDatabaseError('SendMagicLink', eGen, DATABASE_FAILURE_MESSAGES.save)}, {status: 400});

        const actionLink =
            (linkData as { properties?: { action_link?: string | null } } | null)?.properties?.action_link ?? null;

        return NextResponse.json({ok: true, link: actionLink});
    } catch (e) {
        const msg = publicErrorMessage(e, DATABASE_FAILURE_MESSAGES.internal);
        logError('SendMagicLink', 'Failed to send magic link', e);
        return NextResponse.json({ok: false, error: msg}, {status: 500});
    }
});
