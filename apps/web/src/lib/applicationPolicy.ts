export type ApplicationKind = 'business_registration' | 'owner' | 'staff';

type DatabaseErrorLike = {
    code?: string | null;
    message?: string | null;
};

type PolicyFailure = {
    ok: false;
    status: number;
    code: string;
    message: string;
};

const POLICY_MESSAGES: Record<string, Omit<PolicyFailure, 'ok' | 'code'>> = {
    blocked: {
        status: 403,
        message: 'Отправка заявок временно заблокирована модератором. Если это ошибка, обратитесь в поддержку.',
    },
    pending_duplicate: {
        status: 409,
        message: 'Такая заявка уже ожидает рассмотрения.',
    },
    active_limit: {
        status: 429,
        message: 'У вас уже есть максимальное количество активных заявок. Дождитесь решения или отмените ненужную заявку.',
    },
    monthly_limit: {
        status: 429,
        message: 'Достигнут лимит заявок за 30 дней. Попробуйте позже или обратитесь в поддержку.',
    },
    cooldown_24h: {
        status: 429,
        message: 'После отклонения новую заявку можно отправить через 24 часа.',
    },
    cooldown_3d: {
        status: 429,
        message: 'После отклонения повторную заявку сотрудника можно отправить через 3 дня.',
    },
    cooldown_7d: {
        status: 429,
        message: 'После отклонения повторную заявку владельца можно отправить через 7 дней.',
    },
    owner_evidence_required: {
        status: 400,
        message: 'Для заявки владельца добавьте пояснение не короче 20 символов или ссылку, подтверждающую связь с бизнесом.',
    },
    owner_cannot_be_staff: {
        status: 409,
        message: 'Владелец этого бизнеса не может одновременно подать заявку сотрудника в тот же бизнес.',
    },
    unsupported_role: {
        status: 400,
        message: 'Для самостоятельной заявки доступны только роли владельца и сотрудника.',
    },
};

export function mapApplicationPolicyError(error: DatabaseErrorLike | null | undefined): PolicyFailure | null {
    const marker = 'APPLICATION_POLICY:';
    const message = error?.message ?? '';
    const markerIndex = message.indexOf(marker);
    if (markerIndex < 0) return null;

    const code = message.slice(markerIndex + marker.length).split(/[^a-z0-9_]/i, 1)[0];
    const policy = POLICY_MESSAGES[code];
    if (!policy) return null;
    return { ok: false, code, ...policy };
}

type PolicyRpcClient = {
    // Supabase RPC builders are typed as PromiseLike filter builders and vary
    // with generated database types.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc: (name: string, args: Record<string, unknown>) => any;
};

export async function rejectApplicationWithPolicy(params: {
    admin: PolicyRpcClient;
    kind: ApplicationKind;
    applicationId: string;
    reviewerUserId: string;
    note?: string | null;
    blockDays?: number;
}) {
    const blockDays = Number.isInteger(params.blockDays)
        ? Math.max(0, Math.min(params.blockDays ?? 0, 365))
        : 0;
    const { data, error } = await params.admin.rpc('reject_application_with_policy', {
        p_application_kind: params.kind,
        p_application_id: params.applicationId,
        p_reviewer_user_id: params.reviewerUserId,
        p_reason: params.note?.trim().slice(0, 1000) || null,
        p_block_days: blockDays,
    });

    if (error) throw new Error(error.message || 'Не удалось отклонить заявку.');
    if (!data) {
        return {
            ok: false as const,
            status: 409,
            message: 'Заявка уже обработана или недоступна.',
        };
    }
    return { ok: true as const };
}
