import { normalizePhoneToE164 } from '@/lib/senders/sms';

type AdminLike = {
    // PostgREST builders differ for duplicate lookup and insert.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    from: (table: string) => any;
};

type BusinessRegistrationApplicationRow = {
    id: string;
    phone: string | null;
    business_name: string | null;
    city: string | null;
    category: string | null;
    created_business_id?: string | null;
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

export async function approveBusinessApplicationAndCreateBusiness(params: {
    admin: AdminLike;
    applicationId: string;
    reviewerUserId: string;
}) {
    const { data: application, error: applicationError } = await params.admin
        .from('business_registration_applications')
        .select('id,phone,business_name,city,category,created_business_id')
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
    const phone = normalizePhoneToE164(row.phone ?? '');

    const { data: createdBusiness, error: createError } = await params.admin
        .from('businesses')
        .insert({
            name: businessName,
            slug,
            address: row.city ? row.city.trim() : null,
            owner_id: null,
            categories: [category],
            phones: phone ? [phone] : null,
            branch_limit: 1,
            is_approved: true,
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
        return { ok: false as const, status: 400, message: updateApplicationError.message };
    }

    return { ok: true as const, businessId: createdBusiness.id, alreadyCreated: false };
}

export function slugifyBusinessName(input: string): string {
    const map: Record<string, string> = {
        а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y',
        к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
        х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'shch', ы: 'y', э: 'e', ю: 'yu', я: 'ya', ъ: '', ь: '',
        ң: 'ng', ү: 'u', ө: 'o',
    };

    const slug = input
        .toLowerCase()
        .trim()
        .split('')
        .map((char) => map[char] ?? char)
        .join('')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')
        .slice(0, 80);

    return slug || 'business';
}

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

async function resolveBusinessCategory(admin: AdminLike, rawCategory: string | null | undefined): Promise<string> {
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
