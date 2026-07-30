export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import {
    createManualBusiness,
    type ManualBusinessCreationInput,
} from '@/lib/manualBusinessCreationService';

export async function POST(request: Request) {
    try {
        const input = (await request.json()) as ManualBusinessCreationInput;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const cookieStore = await cookies();

        const supabase = createServerClient(url, anonKey, {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                set: () => {},
                remove: () => {},
            },
        });

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
            admin: createClient(url, serviceRoleKey),
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
