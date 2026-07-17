export type BusinessRoleKey = 'owner' | 'admin' | 'manager' | 'staff';
export type BusinessRoleApplicationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export const BUSINESS_ROLE_LABELS: Record<BusinessRoleKey, string> = {
    owner: 'Владелец',
    admin: 'Администратор',
    manager: 'Менеджер',
    staff: 'Сотрудник',
};

export const BUSINESS_ROLE_OPTIONS: BusinessRoleKey[] = ['owner', 'admin', 'manager', 'staff'];
export const SUBMITTABLE_BUSINESS_ROLE_OPTIONS: BusinessRoleKey[] = ['owner', 'staff'];

type DbClient = {
    // Supabase generated types are not stable in this repo yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type AuthUser = {
    id: string;
    email?: string | null;
    phone?: string | null;
    user_metadata?: Record<string, unknown> | null;
};

export function normalizeBusinessRole(value: unknown): BusinessRoleKey | null {
    return typeof value === 'string' && (BUSINESS_ROLE_OPTIONS as string[]).includes(value)
        ? (value as BusinessRoleKey)
        : null;
}

export function canBusinessManagerApproveRole(role: BusinessRoleKey) {
    return role === 'staff';
}

export function getUserDisplayName(user: AuthUser) {
    const meta = user.user_metadata ?? {};
    const fullName = typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
    const name = typeof meta.name === 'string' ? meta.name.trim() : '';
    return fullName || name || user.email || user.phone || 'Пользователь Kezek';
}

export async function submitBusinessRoleApplication(params: {
    admin: DbClient;
    user: AuthUser;
    input: {
        biz_id?: unknown;
        requested_role?: unknown;
        message?: unknown;
    };
}) {
    const bizId = typeof params.input.biz_id === 'string' ? params.input.biz_id.trim() : '';
    const requestedRole = normalizeBusinessRole(params.input.requested_role);
    const message = typeof params.input.message === 'string'
        ? params.input.message.trim().slice(0, 2000)
        : null;

    if (!bizId || !requestedRole) {
        return {
            ok: false as const,
            status: 400,
            code: 'invalid_input',
            message: 'Выберите бизнес и роль.',
        };
    }

    if (!SUBMITTABLE_BUSINESS_ROLE_OPTIONS.includes(requestedRole)) {
        return {
            ok: false as const,
            status: 400,
            code: 'unsupported_role',
            message: 'Сейчас можно отправить заявку только на роль владельца или сотрудника.',
        };
    }

    const { data: business, error: businessError } = await params.admin
        .from('businesses')
        .select('id,name')
        .eq('id', bizId)
        .eq('is_approved', true)
        .maybeSingle();
    if (businessError) throw new Error(businessError.message);
    if (!business) {
        return {
            ok: false as const,
            status: 404,
            code: 'business_not_found',
            message: 'Бизнес не найден или ещё не одобрен.',
        };
    }

    const { data: roleRow, error: roleError } = await params.admin
        .from('roles')
        .select('id')
        .eq('key', requestedRole)
        .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow?.id) {
        return {
            ok: false as const,
            status: 400,
            code: 'role_not_found',
            message: 'Эта роль ещё не настроена в системе.',
        };
    }

    const { data: existingRole, error: existingRoleError } = await params.admin
        .from('user_roles')
        .select('id')
        .eq('user_id', params.user.id)
        .eq('role_id', roleRow.id)
        .eq('biz_id', bizId)
        .maybeSingle();
    if (existingRoleError) throw new Error(existingRoleError.message);
    if (existingRole) {
        return {
            ok: false as const,
            status: 409,
            code: 'already_has_role',
            message: `У вас уже есть роль «${BUSINESS_ROLE_LABELS[requestedRole]}» в этом бизнесе.`,
        };
    }

    const { data: duplicate, error: duplicateError } = await params.admin
        .from('business_role_applications')
        .select('id')
        .eq('applicant_user_id', params.user.id)
        .eq('biz_id', bizId)
        .eq('requested_role', requestedRole)
        .eq('status', 'pending')
        .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message);
    if (duplicate) {
        return {
            ok: false as const,
            status: 409,
            code: 'pending_duplicate',
            message: 'Такая заявка уже ожидает рассмотрения.',
        };
    }

    const { data, error } = await params.admin
        .from('business_role_applications')
        .insert({
            applicant_user_id: params.user.id,
            biz_id: bizId,
            requested_role: requestedRole,
            applicant_name: getUserDisplayName(params.user),
            applicant_email: params.user.email ?? null,
            applicant_phone: params.user.phone ?? null,
            message,
            source: 'web',
        })
        .select('id')
        .single();
    if (error) throw new Error(error.message);

    return { ok: true as const, id: data?.id ?? null };
}

export async function approveBusinessRoleApplication(params: {
    admin: DbClient;
    applicationId: string;
    reviewerUserId: string;
    note?: string | null;
}) {
    const { data: application, error: applicationError } = await params.admin
        .from('business_role_applications')
        .select('id,applicant_user_id,biz_id,requested_role,status')
        .eq('id', params.applicationId)
        .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    if (!application) {
        return { ok: false as const, status: 404, message: 'Заявка не найдена.' };
    }
    if (application.status !== 'pending') {
        return { ok: false as const, status: 409, message: 'Заявка уже обработана.' };
    }

    const role = normalizeBusinessRole(application.requested_role);
    if (!role) {
        return { ok: false as const, status: 400, message: 'Некорректная роль в заявке.' };
    }

    const { data: roleRow, error: roleError } = await params.admin
        .from('roles')
        .select('id')
        .eq('key', role)
        .maybeSingle();
    if (roleError) throw new Error(roleError.message);
    if (!roleRow?.id) {
        return { ok: false as const, status: 400, message: 'Роль не найдена.' };
    }

    const { error: insertError } = await params.admin
        .from('user_roles')
        .insert({
            user_id: application.applicant_user_id,
            role_id: roleRow.id,
            biz_id: application.biz_id,
        });
    if (insertError && insertError.code !== '23505') {
        throw new Error(insertError.message);
    }

    if (role === 'owner') {
        await params.admin
            .from('businesses')
            .update({ owner_id: application.applicant_user_id })
            .eq('id', application.biz_id);
    }

    const { error: updateError } = await params.admin
        .from('business_role_applications')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: params.reviewerUserId,
            review_note: params.note || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.applicationId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const, role };
}

export async function rejectBusinessRoleApplication(params: {
    admin: DbClient;
    applicationId: string;
    reviewerUserId: string;
    note?: string | null;
}) {
    const { data: application, error: applicationError } = await params.admin
        .from('business_role_applications')
        .select('id,status')
        .eq('id', params.applicationId)
        .maybeSingle();
    if (applicationError) throw new Error(applicationError.message);
    if (!application) {
        return { ok: false as const, status: 404, message: 'Заявка не найдена.' };
    }
    if (application.status !== 'pending') {
        return { ok: false as const, status: 409, message: 'Заявка уже обработана.' };
    }

    const { error: updateError } = await params.admin
        .from('business_role_applications')
        .update({
            status: 'rejected',
            reviewed_at: new Date().toISOString(),
            reviewed_by: params.reviewerUserId,
            review_note: params.note || null,
            updated_at: new Date().toISOString(),
        })
        .eq('id', params.applicationId);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const };
}
