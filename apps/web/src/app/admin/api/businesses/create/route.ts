export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import {
    createManualBusiness,
    type ManualBusinessCreationInput,
} from '@/lib/manualBusinessCreationService';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function POST(request: Request) {
    try {
        const input = (await request.json()) as ManualBusinessCreationInput;

        const supabase = await createSupabaseServerClient();

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ ok: false, code: 'unauthorized' }, { status: 401 });
        }

        const { data: isSuperAdmin, error: roleError } = await supabase.rpc('is_super_admin');
        if (roleError) {
            return NextResponse.json(
                { ok: false, code: 'role_check_failed', error: roleError.message },
                { status: 400 },
            );
        }
        if (!isSuperAdmin) {
            return NextResponse.json({ ok: false, code: 'forbidden' }, { status: 403 });
        }

        const result = await createManualBusiness({
            admin: createSupabaseAdminClient(),
            actorUserId: user.id,
            input,
        });

        if (!result.ok) {
            return NextResponse.json(
                {
                    ok: false,
                    code: result.code,
                    error: result.message,
                    duplicates: result.duplicates,
                },
                { status: result.status },
            );
        }

        return NextResponse.json({ ok: true, id: result.businessId }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            {
                ok: false,
                code: 'unexpected_error',
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
