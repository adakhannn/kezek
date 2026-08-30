import { mapApplicationPolicyError } from '@/lib/applicationPolicy';
import { normalizeBusinessNameForMatch } from '@/lib/businessName';
import { slugifyBusinessName } from '@/lib/businessSlug';
import { normalizePhoneToE164 } from '@/lib/senders/sms';

type AdminLike = {
    // PostgREST builders differ for duplicate lookup and insert.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type BusinessRegistrationApplicationRow = {
    id: string;
    applicant_user_id: string | null;
    phone: string | null;
    business_name: string | null;
    category: string | null;
    created_business_id?: string | null;
};

export type DirectoryLinks = {
    instagram?: string | null;
    two_gis?: string | null;
    google_maps?: string | null;
    yandex_maps?: string | null;
};

export type BusinessApplicationInput = {
    contact_name?: unknown;
    phone?: unknown;
    email?: unknown;
    business_name?: unknown;
    category?: unknown;
    comment?: unknown;
    website?: unknown;
    instagram?: unknown;
    two_gis?: unknown;
    google_maps?: unknown;
    yandex_maps?: unknown;
};

function text(value: unknown, max: number) {
    return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeUrl(value: unknown): string | null {
    const raw = text(value, 500);
    if (!raw) return null;
    try {
        const parsed = new URL(raw);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
        return null;
    }
}

function directoryLinks(input: BusinessApplicationInput): DirectoryLinks {
    return {
        instagram: safeUrl(input.instagram),
        two_gis: safeUrl(input.two_gis),
        google_maps: safeUrl(input.google_maps),
        yandex_maps: safeUrl(input.yandex_maps),
    };
}

export async function approveBusinessApplicationAndCreateBusiness(params: {
    admin: AdminLike;
    applicationId: string;
    reviewerUserId: string;
}) {
    const { data: application, error: applicationError } = await params.admin
        .from('business_registration_applications')
        .select('id,applicant_user_id,phone,business_name,category,created_business_id')
        .eq('id', params.applicationId)
        .maybeSingle();

    if (applicationError) {
        return { ok: false as const, status: 400, message: applicationError.message };
    }
    if (!application) {
        return { ok: false as const, status: 404, message: 'Заявка не найдена' };
    }

    const row = application as BusinessRegistrationApplicationRow;
    if (row.created_business_id) {
        const { error: updateExistingError } = await params.admin
            .from('business_registration_applications')
            .update({
                status: 'approved',
                reviewed_at: new Date().toISOString(),
                reviewed_by: params.reviewerUserId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', row.id);

        if (updateExistingError) {
            return { ok: false as const, status: 400, message: updateExistingError.message };
        }
        return { ok: true as const, businessId: row.created_business_id, alreadyCreated: true };
    }

    const businessName = (row.business_name ?? '').trim();
    if (!businessName) {
        return { ok: false as const, status: 400, message: 'В заявке нет названия бизнеса' };
    }

    const slug = await makeUniqueBusinessSlug(params.admin, businessName);
    const category = await resolveBusinessCategory(params.admin, row.category);
    let ownerRoleId: string | null = null;

    if (row.applicant_user_id) {
        const { data: ownerRole, error: ownerRoleError } = await params.admin
            .from('roles')
            .select('id')
            .eq('key', 'owner')
            .maybeSingle();

        if (ownerRoleError) {
            return { ok: false as const, status: 400, message: ownerRoleError.message };
        }
        if (!ownerRole?.id) {
            return { ok: false as const, status: 400, message: 'РћСЃРЅРѕРІРЅР°СЏ СЂРѕР»СЊ РІР»Р°РґРµР»СЊС†Р° РЅРµ РЅР°Р№РґРµРЅР°.' };
        }
        ownerRoleId = ownerRole.id;
    }

    const { data: createdBusiness, error: createError } = await params.admin
        .from('businesses')
        .insert({
            name: businessName,
            slug,
            owner_id: row.applicant_user_id,
            categories: [category],
            // Applicant phone is review/contact data, not a public business contact.
            // The owner configures business-owned contacts after approval.
            phones: null,
            contact_phone: null,
            contact_whatsapp: null,
            contact_email: null,
            website_url: null,
            branch_limit: 1,
            is_approved: true,
            creation_source: 'public_application',
            created_by_user_id: params.reviewerUserId,
            source_application_id: row.id,
        })
        .select('id')
        .single();

    if (createError || !createdBusiness?.id) {
        return {
            ok: false as const,
            status: 400,
            message: createError?.message || 'Не удалось создать бизнес из заявки',
        };
    }

    if (row.applicant_user_id && ownerRoleId) {
        const { error: ownerRoleError } = await params.admin
            .from('user_roles')
            .insert({
                user_id: row.applicant_user_id,
                role_id: ownerRoleId,
                biz_id: createdBusiness.id,
            });

        if (ownerRoleError && ownerRoleError.code !== '23505') {
            await params.admin.from('businesses').delete().eq('id', createdBusiness.id);
            return { ok: false as const, status: 400, message: ownerRoleError.message };
        }
    }

    const { error: updateApplicationError } = await params.admin
        .from('business_registration_applications')
        .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: params.reviewerUserId,
            updated_at: new Date().toISOString(),
            created_business_id: createdBusiness.id,
        })
        .eq('id', row.id);

    if (updateApplicationError) {
        await params.admin.from('user_roles').delete().eq('biz_id', createdBusiness.id);
        await params.admin.from('businesses').delete().eq('id', createdBusiness.id);
        return { ok: false as const, status: 400, message: updateApplicationError.message };
    }

    return { ok: true as const, businessId: createdBusiness.id, alreadyCreated: false };
}

export { slugifyBusinessName } from '@/lib/businessSlug';

async function makeUniqueBusinessSlug(admin: AdminLike, baseName: string): Promise<string> {
    const base = slugifyBusinessName(baseName);

    for (let index = 0; index < 50; index += 1) {
        const candidate = index === 0 ? base : `${base}-${index + 1}`;
        const { data, error } = await admin
            .from('businesses')
            .select('id')
            .eq('slug', candidate)
            .limit(1)
            .maybeSingle();

        if (error) throw new Error(error.message || 'Не удалось проверить slug бизнеса');
        if (!data) return candidate;
    }

    return `${base}-${Date.now().toString(36)}`;
}

export async function resolveBusinessCategory(admin: AdminLike, rawCategory: string | null | undefined): Promise<string> {
    const normalized = (rawCategory ?? '').trim().toLowerCase();
    const { data, error } = await admin
        .from('categories')
        .select('slug,name_ru,is_active')
        .eq('is_active', true)
        .order('name_ru', { ascending: true });

    if (error) throw new Error(error.message || 'Не удалось загрузить категории');

    const categories = (data ?? []) as Array<{ slug: string; name_ru: string | null; is_active: boolean | null }>;
    if (!categories.length) throw new Error('Нет активных категорий для создания бизнеса');

    const exact = categories.find((category) => (
        category.slug.toLowerCase() === normalized
        || (category.name_ru ?? '').trim().toLowerCase() === normalized
    ));
    if (exact) return exact.slug;

    if (normalized) {
        throw new Error(`Сначала добавьте предложенную категорию «${rawCategory?.trim()}» в справочник категорий.`);
    }

    return (categories.find((category) => category.slug === 'barbershop') ?? categories[0]).slug;
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
    const email = text(params.input.email, 254).toLowerCase();
    if (!contactName || !businessName || !phone || !email) {
        return { ok: false as const, status: 400, code: 'required_fields', message: 'Укажите имя, название бизнеса, телефон и email.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false as const, status: 400, code: 'invalid_email', message: 'Укажите корректный email.' };
    }

    const normalizedBusinessName = normalizeBusinessNameForMatch(businessName);
    const slugPrefix = slugifyBusinessName(businessName);
    const { data: businessCandidates, error: businessLookupError } = await params.admin
        .from('businesses')
        .select('id,name,slug')
        .like('slug', `${slugPrefix}%`)
        .limit(25);
    if (businessLookupError) {
        throw new Error(businessLookupError.message || 'Не удалось проверить название бизнеса');
    }
    const existingBusiness = (businessCandidates ?? []).find((candidate: { name?: string | null }) => (
        normalizeBusinessNameForMatch(candidate.name ?? '') === normalizedBusinessName
    ));
    if (existingBusiness) {
        return {
            ok: false as const,
            status: 409,
            code: 'business_exists',
            message: 'Бизнес с таким названием уже есть в Kezek. Запросите доступ владельца вместо создания повторной карточки.',
        };
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
            category: text(params.input.category, 120) || null,
            comment: text(params.input.comment, 2000) || null,
            directory_links: directoryLinks(params.input),
            source: 'web',
        })
        .select('id')
        .single();
    if (error) {
        const policyFailure = mapApplicationPolicyError(error);
        if (policyFailure) return policyFailure;
        if (error.code === '23505') {
            return {
                ok: false as const,
                status: 409,
                code: 'pending_duplicate',
                message: 'Такая заявка уже ожидает рассмотрения.',
            };
        }
        throw new Error(error.message || 'Не удалось сохранить заявку');
    }
    return { ok: true as const, id: data?.id ?? null };
}
