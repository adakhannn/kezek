import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import {
    selectApplicationEmail,
    selectApplicationPhone,
    type BusinessApplicationForm,
    type BusinessOption,
    type CategoryOption,
    type EvidenceLinks,
    type MyRoleApplication,
    type RoleApplicationMode,
} from './applicationModel';

export type BusinessApplicationDefaults = {
    categories: CategoryOption[];
    contact_name: string;
    phone: string;
    email: string;
};

/**
 * What the website's /business/apply page reads before the form: the active categories and the
 * applicant's name, phone and e-mail (profile, account, confirmed WhatsApp, notification e-mails).
 * Read with the user's session; RLS applies as on the website's server component.
 */
export async function fetchBusinessApplicationDefaults(): Promise<BusinessApplicationDefaults> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) throw new Error('Not signed in');

    const [categoriesResult, profileResult, emailsResult] = await Promise.all([
        supabase.from('categories').select('slug,name_ru').eq('is_active', true).order('name_ru', { ascending: true }),
        supabase.from('profiles').select('full_name,phone,whatsapp_phone,whatsapp_verified').eq('id', user.id).maybeSingle(),
        supabase.from('user_notification_emails').select('email,verified,enabled').eq('user_id', user.id).eq('verified', true),
    ]);
    if (categoriesResult.error) throw categoriesResult.error;

    const categories = ((categoriesResult.data ?? []) as { slug: unknown; name_ru: unknown }[]).flatMap((category) =>
        typeof category.slug === 'string' && typeof category.name_ru === 'string' ? [{ slug: category.slug, name: category.name_ru }] : []);
    const profile = (profileResult.data ?? null) as {
        full_name?: string | null;
        phone?: string | null;
        whatsapp_phone?: string | null;
        whatsapp_verified?: boolean | null;
    } | null;
    const metadata = (user.user_metadata ?? {}) as { full_name?: unknown; phone?: unknown };
    const metadataName = typeof metadata.full_name === 'string' ? metadata.full_name.trim() : '';
    const metadataPhone = typeof metadata.phone === 'string' ? metadata.phone.trim() : '';

    return {
        categories,
        contact_name: profile?.full_name?.trim() || metadataName,
        phone: selectApplicationPhone({
            profilePhone: profile?.phone,
            accountPhone: user.phone,
            metadataPhone,
            whatsAppPhone: profile?.whatsapp_phone,
            whatsAppVerified: profile?.whatsapp_verified,
        }),
        email: selectApplicationEmail({
            accountEmail: user.email,
            notificationEmails: (emailsResult.data ?? []) as { email: string | null; verified?: boolean | null; enabled?: boolean | null }[],
        }),
    };
}

export async function submitBusinessApplication(form: BusinessApplicationForm, category: string): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; code?: string }>('/business-applications', {
        method: 'POST',
        // `website` is the website's hidden anti-bot field: always empty from the app.
        body: JSON.stringify({ ...form, website: '', category }),
    });
    if (!response?.ok) throw Object.assign(new Error('Application was not sent'), { details: response });
}

export async function searchBusinesses(query: string, signal?: AbortSignal): Promise<BusinessOption[]> {
    const response = await apiRequest<{ ok?: boolean; items?: BusinessOption[] }>(
        `/businesses/search?q=${encodeURIComponent(query.trim())}`,
        { signal },
    );
    if (!response?.ok || !Array.isArray(response.items)) throw new Error('Business search failed');
    return response.items;
}

export async function fetchMyRoleApplications(mode: RoleApplicationMode): Promise<MyRoleApplication[]> {
    const response = await apiRequest<{ ok?: boolean; items?: MyRoleApplication[] }>(`/business-role-applications?requested_role=${mode}`);
    if (!response?.ok) throw new Error('Role applications were not loaded');
    return response.items ?? [];
}

export async function submitRoleApplication(params: {
    bizId: string;
    mode: RoleApplicationMode;
    message: string;
    evidence: EvidenceLinks;
}): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; message?: string }>('/business-role-applications', {
        method: 'POST',
        body: JSON.stringify({
            biz_id: params.bizId,
            requested_role: params.mode,
            message: params.message,
            evidence_links: params.evidence,
        }),
    });
    if (!response?.ok) throw new Error(response?.message || 'Role application was not sent');
}

export async function cancelRoleApplication(id: string): Promise<void> {
    const response = await apiRequest<{ ok?: boolean; message?: string }>(`/business-role-applications/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!response?.ok) throw new Error(response?.message || 'Role application was not cancelled');
}

/** Whether the profile has a name: the staff form asks for one first, as on the website. */
export async function fetchProfileHasName(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data, error } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
    if (error) return true;
    return !!(data as { full_name?: string | null } | null)?.full_name?.trim();
}
