import type { SupabaseClient } from '@supabase/supabase-js';

import { slugifyBusinessName } from '@/lib/businessSlug';
import { normalizePhoneToE164 } from '@/lib/senders/sms';

type AdminLike = {
    from: SupabaseClient['from'];
};

export type ManualBusinessCreationInput = {
    name?: string;
    slug?: string;
    phone?: string;
    categories?: string[];
    branch_limit?: number;
    reason?: string;
    acknowledge_manual?: boolean;
    duplicate_override?: boolean;
};

export type PossibleBusinessDuplicate = {
    id: string;
    name: string;
    slug: string;
    phones: string[] | null;
    matchedBy: Array<'name' | 'phone'>;
};

type Failure = {
    ok: false;
    status: number;
    code: string;
    message: string;
    duplicates?: PossibleBusinessDuplicate[];
};

type Success = {
    ok: true;
    businessId: string;
};

const fail = (status: number, code: string, message: string): Failure => ({
    ok: false,
    status,
    code,
    message,
});

function normalizeComparableName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
}

export async function createManualBusiness(params: {
    admin: AdminLike;
    actorUserId: string;
    input: ManualBusinessCreationInput;
}): Promise<Failure | Success> {
    const name = params.input.name?.trim().replace(/\s+/g, ' ') ?? '';
    const slug = slugifyBusinessName(params.input.slug?.trim() || name);
    const reason = params.input.reason?.trim().replace(/\s+/g, ' ') ?? '';
    const categories = Array.from(new Set((params.input.categories ?? []).map((value) => value.trim()).filter(Boolean)));
    const branchLimit = params.input.branch_limit;
    const phone = normalizePhoneToE164(params.input.phone);

    if (name.length < 2 || name.length > 160) {
        return fail(400, 'invalid_name', 'Business name must contain 2–160 characters');
    }
    if (!slug || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return fail(400, 'invalid_slug', 'Business slug is invalid');
    }
    if (phone && !/^\+\d{8,15}$/.test(phone)) {
        return fail(400, 'invalid_phone', 'Phone number must be in international format');
    }
    if (categories.length === 0) {
        return fail(400, 'categories_required', 'At least one category is required');
    }
    if (!Number.isInteger(branchLimit) || (branchLimit ?? 0) < 1 || (branchLimit ?? 0) > 1000) {
        return fail(400, 'invalid_branch_limit', 'Branch limit must be an integer between 1 and 1000');
    }
    if (reason.length < 10 || reason.length > 1000) {
        return fail(400, 'invalid_reason', 'Manual creation reason must contain 10–1000 characters');
    }
    if (params.input.acknowledge_manual !== true) {
        return fail(400, 'acknowledgement_required', 'Manual creation must be explicitly acknowledged');
    }

    const { data: slugMatch, error: slugError } = await params.admin
        .from('businesses')
        .select('id')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();

    if (slugError) return fail(400, 'duplicate_check_failed', slugError.message);
    if (slugMatch) return fail(409, 'slug_taken', 'This URL slug is already used by another business');

    const { data: categoryRows, error: categoryError } = await params.admin
        .from('categories')
        .select('slug,is_active')
        .in('slug', categories);

    if (categoryError) return fail(400, 'category_check_failed', categoryError.message);

    const activeCategorySlugs = new Set(
        (categoryRows ?? []).filter((row: { is_active: boolean | null }) => row.is_active !== false).map((row: { slug: string }) => row.slug),
    );
    const invalidCategories = categories.filter((category) => !activeCategorySlugs.has(category));
    if (invalidCategories.length > 0) {
        return fail(400, 'invalid_categories', `Inactive or unknown categories: ${invalidCategories.join(', ')}`);
    }

    const duplicateMap = new Map<string, PossibleBusinessDuplicate>();
    const registerDuplicates = (
        rows: Array<{ id: string; name: string; slug: string; phones: string[] | null }> | null,
        matchedBy: 'name' | 'phone',
    ) => {
        for (const row of rows ?? []) {
            const existing = duplicateMap.get(row.id);
            if (existing) {
                if (!existing.matchedBy.includes(matchedBy)) existing.matchedBy.push(matchedBy);
            } else {
                duplicateMap.set(row.id, { ...row, matchedBy: [matchedBy] });
            }
        }
    };

    const { data: nameMatches, error: nameError } = await params.admin
        .from('businesses')
        .select('id,name,slug,phones')
        .ilike('name', escapeLike(name))
        .limit(10);

    if (nameError) return fail(400, 'duplicate_check_failed', nameError.message);
    registerDuplicates(
        (nameMatches ?? []).filter(
            (row: { name: string }) => normalizeComparableName(row.name) === normalizeComparableName(name),
        ),
        'name',
    );

    if (phone) {
        const { data: phoneMatches, error: phoneError } = await params.admin
            .from('businesses')
            .select('id,name,slug,phones')
            .contains('phones', [phone])
            .limit(10);

        if (phoneError) return fail(400, 'duplicate_check_failed', phoneError.message);
        registerDuplicates(phoneMatches, 'phone');
    }

    const duplicates = Array.from(duplicateMap.values());
    if (duplicates.length > 0 && params.input.duplicate_override !== true) {
        return {
            ok: false,
            status: 409,
            code: 'possible_duplicate',
            message: 'Possible duplicate businesses were found',
            duplicates,
        };
    }

    const { data: createdBusiness, error: createError } = await params.admin
        .from('businesses')
        .insert({
            name,
            slug,
            address: null,
            owner_id: null,
            categories,
            phones: phone ? [phone] : null,
            branch_limit: branchLimit,
            is_approved: true,
            creation_source: 'admin_manual',
            created_by_user_id: params.actorUserId,
            source_application_id: null,
        })
        .select('id')
        .single();

    if (createError || !createdBusiness?.id) {
        return fail(400, 'create_failed', createError?.message ?? 'Failed to create business');
    }

    const { error: contextAuditError } = await params.admin
        .from('business_creation_audit_log')
        .insert({
            business_id: createdBusiness.id,
            event_type: 'manual_creation_context',
            source: 'admin_manual',
            actor_user_id: params.actorUserId,
            application_id: null,
            reason,
            metadata: {
                duplicate_override: params.input.duplicate_override === true,
                duplicate_business_ids: duplicates.map((duplicate) => duplicate.id),
                categories,
                branch_limit: branchLimit,
                phone_provided: Boolean(phone),
            },
        });

    if (contextAuditError) {
        await params.admin.from('businesses').delete().eq('id', createdBusiness.id);
        return fail(500, 'audit_failed', contextAuditError.message);
    }

    return { ok: true, businessId: createdBusiness.id };
}
