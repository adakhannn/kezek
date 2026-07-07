import { normalizePhoneToE164 } from '@/lib/senders/sms';

type AdminLike = {
    // PostgREST builders differ for duplicate lookup and insert.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

export type BusinessApplicationInput = {
    contact_name?: unknown;
    phone?: unknown;
    email?: unknown;
    business_name?: unknown;
    city?: unknown;
    category?: unknown;
    comment?: unknown;
    website?: unknown;
};

function text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function submitBusinessApplication(params: {
    admin: AdminLike;
    userId?: string | null;
    input: BusinessApplicationInput;
}) {
    if (text(params.input.website, 200)) {
        return { ok: true as const, id: null }; // honeypot: do not reveal detection
    }

    const contactName = text(params.input.contact_name, 120);
    const businessName = text(params.input.business_name, 180);
    const phone = normalizePhoneToE164(text(params.input.phone, 40));
    const email = text(params.input.email, 254).toLowerCase() || null;
    if (!contactName || !businessName || !phone) {
        return { ok: false as const, status: 400, code: 'required_fields', message: 'Укажите имя, название бизнеса и корректный телефон.' };
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false as const, status: 400, code: 'invalid_email', message: 'Укажите корректный email.' };
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: duplicate, error: duplicateError } = await params.admin
        .from('business_registration_applications')
        .select('id')
        .eq('phone', phone)
        .gte('created_at', since)
        .in('status', ['new', 'contacted'])
        .limit(1)
        .maybeSingle();
    if (duplicateError) throw new Error(duplicateError.message || 'Не удалось проверить заявку');
    if (duplicate) {
        return { ok: false as const, status: 409, code: 'recent_duplicate', message: 'Заявка с этим номером уже отправлена. Мы скоро свяжемся с вами.' };
    }

    const { data, error } = await params.admin
        .from('business_registration_applications')
        .insert({
            applicant_user_id: params.userId ?? null,
            contact_name: contactName,
            phone,
            email,
            business_name: businessName,
            city: text(params.input.city, 120) || null,
            category: text(params.input.category, 120) || null,
            comment: text(params.input.comment, 2000) || null,
            source: 'web',
        })
        .select('id')
        .single();
    if (error) throw new Error(error.message || 'Не удалось сохранить заявку');
    return { ok: true as const, id: data?.id ?? null };
}
