import { runBranchDelete } from '@/lib/branchDeleteService';

type Failure = {
    ok: false;
    status: 400 | 403 | 409;
    error: 'validation' | 'forbidden' | 'conflict' | 'internal';
    message: string;
    details?: Record<string, unknown>;
};

type Success = {
    ok: true;
};

export type BranchDeleteRouteResult = Failure | Success;

export async function runBranchDeleteRoute({
    supabase,
    admin,
    branchId,
    bizId,
}: {
    supabase: any;
    admin: any;
    branchId: string;
    bizId: string;
}): Promise<BranchDeleteRouteResult> {
    const { data: isSuper } = await supabase.rpc('is_super_admin');
    if (!isSuper) {
        return {
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Только суперадмин может удалять филиалы',
        };
    }

    const result = await runBranchDelete({
        admin,
        branchId,
        bizId,
    });

    if (!result.ok) {
        return {
            ok: false,
            status: result.statusCode,
            error: result.errorType,
            message: result.message,
            details: result.details,
        };
    }

    return {
        ok: true,
    };
}
