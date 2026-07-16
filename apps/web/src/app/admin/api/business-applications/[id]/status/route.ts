export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { approveBusinessApplicationAndCreateBusiness } from '@/lib/businessApplicationService';
import { getRouteParamRequired } from '@/lib/routeParams';

const statuses = new Set(['new', 'contacted', 'approved', 'rejected']);

export async function POST(request: Request, context: unknown) {
    const id = await getRouteParamRequired(context, 'id');
    const cookieStore = await cookies();
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        cookies: { get: (name: string) => cookieStore.get(name)?.value, set: () => {}, remove: () => {} },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ ok: false, error: 'auth' }, { status: 401 });
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    if (!isSuper) return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as { status?: unknown };
    if (typeof body.status !== 'string' || !statuses.has(body.status)) return Response.json({ ok: false, error: 'invalid status' }, { status: 400 });

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    if (body.status === 'approved') {
        const result = await approveBusinessApplicationAndCreateBusiness({
            admin,
            applicationId: id,
            reviewerUserId: user.id,
        });

        if (!result.ok) {
            return Response.json({ ok: false, error: result.message }, { status: result.status });
        }

        return Response.json({ ok: true, businessId: result.businessId, alreadyCreated: result.alreadyCreated });
    }

    const { error } = await admin.from('business_registration_applications').update({
        status: body.status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) return Response.json({ ok: false, error: error.message }, { status: 400 });
    return Response.json({ ok: true });
}
