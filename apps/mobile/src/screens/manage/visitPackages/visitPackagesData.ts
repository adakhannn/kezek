import * as Crypto from 'expo-crypto';

import type { Translate } from '../../../i18n';
import { apiRequest } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

/*
 * Visit packages of the website (/dashboard/visit-packages, /new, /[id]): the package types sold
 * to clients (api/dashboard/visit-package-plans), the sold packages (api/dashboard/visit-packages)
 * and the sale to one client (api/dashboard/clients/[clientId]/visit-packages).
 */

export type DiscountType = 'percent' | 'fixed_price';

export type VisitPackagePlan = {
    id: string;
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
    validity_days: number;
    discount_type: DiscountType;
    discount_value: number;
    service_id: string | null;
    branch_ids: string[] | null;
    is_active: boolean;
};

export type SoldPackage = {
    id: string;
    client_id: string;
    client_name: string | null;
    plan_id: string;
    remaining_visits: number;
    valid_until: string;
    purchased_at: string;
    plan_name_ru: string | null;
    plan_name_ky: string | null;
    plan_name_en: string | null;
    plan_visit_count: number | null;
};

export type SoldStatusFilter = 'active' | 'expired' | 'all';

export type PlanForm = {
    name_ru: string;
    name_ky: string | null;
    name_en: string | null;
    visit_count: number;
    validity_days: number;
    discount_type: DiscountType;
    discount_value: number;
    service_id: string | null;
    branch_ids: string[] | null;
    is_active?: boolean;
};

/** A new package type starts as on the website: 5 visits, 30 days, 10 % off, any service, all branches. */
export const NEW_PLAN_FORM: PlanForm = {
    name_ru: '',
    name_ky: null,
    name_en: null,
    visit_count: 5,
    validity_days: 30,
    discount_type: 'percent',
    discount_value: 10,
    service_id: null,
    branch_ids: null,
};

/** The first problem of the form, in the website's order and wording; null when it can be saved. */
export function planFormError(form: PlanForm, t: Translate): string | null {
    if (!form.name_ru.trim()) return t('ops.packages.form.error.nameRequired');
    if (!Number.isFinite(form.visit_count) || form.visit_count < 1 || form.visit_count > 1000) return t('ops.packages.form.error.visitCount');
    if (!Number.isFinite(form.validity_days) || form.validity_days < 1 || form.validity_days > 3650) return t('ops.packages.form.error.validityDays');
    if (form.discount_type === 'percent' && form.discount_value > 100) return t('ops.packages.form.error.percentMax');
    if (!Number.isFinite(form.discount_value) || form.discount_value < 0 || form.discount_value > 100000) return t('ops.packages.form.error.discountRange');
    return null;
}

/** The body of POST (create) or PATCH (edit) /api/dashboard/visit-package-plans. */
export function planPayload(form: PlanForm, isEdit: boolean) {
    return {
        name_ru: form.name_ru.trim(),
        name_ky: form.name_ky?.trim() || null,
        name_en: form.name_en?.trim() || null,
        visit_count: form.visit_count,
        validity_days: form.validity_days,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        service_id: form.service_id || null,
        branch_ids: form.branch_ids && form.branch_ids.length > 0 ? form.branch_ids : null,
        ...(isEdit && form.is_active !== undefined ? { is_active: form.is_active } : {}),
    };
}

/** Adds or removes a branch; no branch left means "every branch" (null), as on the website. */
export function toggleBranch(branchIds: string[] | null, id: string): string[] | null {
    const ids = new Set(branchIds ?? []);
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    return ids.size === 0 ? null : Array.from(ids);
}

/** '10%' or the fixed price per visit. */
export function formatDiscount(plan: Pick<VisitPackagePlan, 'discount_type' | 'discount_value'>): string {
    return plan.discount_type === 'percent' ? `${plan.discount_value}%` : `${plan.discount_value}`;
}

/** "any service, all branches" / "service, 2 br." (website formatBinding). */
export function formatBinding(plan: Pick<VisitPackagePlan, 'service_id' | 'branch_ids'>, t: Translate): string {
    return [
        plan.service_id ? t('ops.packages.bindingService') : t('ops.packages.bindingAnyService'),
        plan.branch_ids && plan.branch_ids.length > 0
            ? t('ops.packages.bindingBranches', { count: plan.branch_ids.length })
            : t('ops.packages.bindingAllBranches'),
    ].join(', ');
}

/** "Visits: 5, Validity (days): 30, Discount: 10%" as the sale dialog describes a plan. */
export function planTerms(plan: Pick<VisitPackagePlan, 'visit_count' | 'validity_days' | 'discount_type' | 'discount_value'>, t: Translate): string {
    return [
        `${t('ops.packages.sell.visitsLabel')}: ${plan.visit_count}`,
        `${t('ops.packages.sell.validityDaysLabel')}: ${plan.validity_days}`,
        plan.discount_type === 'percent'
            ? `${t('ops.packages.sell.discountLabel')}: ${plan.discount_value}%`
            : `${t('ops.packages.sell.pricePerVisitLabel')}: ${plan.discount_value}`,
    ].join(', ');
}

/** The plan name in the app language when the business filled it, else the Russian one. */
export function planName(plan: { name_ru: string | null; name_ky?: string | null; name_en?: string | null }, locale: string): string {
    return (locale === 'ky' && plan.name_ky) || (locale === 'en' && plan.name_en) || plan.name_ru || '';
}

type Envelope<T> = { ok?: boolean; data?: T; message?: string };

export async function fetchPlans(): Promise<VisitPackagePlan[]> {
    const response = await apiRequest<Envelope<{ plans?: VisitPackagePlan[] }>>('/api/dashboard/visit-package-plans');
    if (!response?.ok || !Array.isArray(response.data?.plans)) throw new Error('Unexpected plans response');
    return response.data.plans.map((plan) => ({ ...plan, discount_value: Number(plan.discount_value) }));
}

export async function fetchSoldPackages(status: SoldStatusFilter, branchId: string): Promise<SoldPackage[]> {
    const params: string[] = [];
    if (status !== 'all') params.push(`status=${status}`);
    if (branchId) params.push(`branchId=${encodeURIComponent(branchId)}`);
    const response = await apiRequest<Envelope<{ packages?: SoldPackage[] }>>(`/api/dashboard/visit-packages${params.length ? `?${params.join('&')}` : ''}`);
    if (!response?.ok || !Array.isArray(response.data?.packages)) throw new Error('Unexpected packages response');
    return response.data.packages;
}

export async function fetchDashboardBranches(): Promise<{ id: string; name: string }[]> {
    const response = await apiRequest<Envelope<{ id: string; name: string }[]>>('/api/dashboard/branches/list');
    return response?.ok && Array.isArray(response.data) ? response.data : [];
}

export async function deactivatePlan(planId: string): Promise<void> {
    const response = await apiRequest<Envelope<unknown>>(`/api/dashboard/visit-package-plans/${encodeURIComponent(planId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false }),
    });
    if (!response?.ok) throw new Error(response?.message || 'Deactivation failed');
}

export async function savePlan(form: PlanForm, planId: string | undefined): Promise<void> {
    const response = await apiRequest<Envelope<unknown>>(
        planId ? `/api/dashboard/visit-package-plans/${encodeURIComponent(planId)}` : '/api/dashboard/visit-package-plans',
        { method: planId ? 'PATCH' : 'POST', body: JSON.stringify(planPayload(form, !!planId)) },
    );
    if (!response?.ok) throw new Error(response?.message || 'Save failed');
}

export type PlanFormOptions = {
    branches: { id: string; name: string }[];
    services: { id: string; name_ru: string; branch_id: string }[];
    plan: VisitPackagePlan | null;
};

/** The active branches and services of the form and, when editing, the plan (the website's server read). */
export async function fetchPlanFormOptions(bizId: string, planId?: string): Promise<PlanFormOptions> {
    const [branches, services, plan] = await Promise.all([
        supabase.from('branches').select('id,name').eq('biz_id', bizId).eq('is_active', true).order('name'),
        supabase.from('services').select('id,name_ru,branch_id').eq('biz_id', bizId).eq('active', true).order('name_ru'),
        planId
            ? supabase
                  .from('visit_package_plans')
                  .select('id,name_ru,name_ky,name_en,visit_count,validity_days,discount_type,discount_value,service_id,branch_ids,is_active')
                  .eq('id', planId)
                  .eq('biz_id', bizId)
                  .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);
    // FE-08: empty lists after a failed read would drop the plan's service and branches on save.
    if (branches.error) throw branches.error;
    if (services.error) throw services.error;
    if (plan.error) throw plan.error;
    const row = plan.data as VisitPackagePlan | null;
    return {
        branches: (branches.data ?? []) as PlanFormOptions['branches'],
        services: (services.data ?? []) as PlanFormOptions['services'],
        plan: row ? { ...row, discount_value: Number(row.discount_value) } : null,
    };
}

/** A new key per sale attempt (API-11): a retry after a lost answer cannot sell a second package. */
export function newSaleKey(): string {
    return Crypto.randomUUID();
}

export async function sellPackage(clientId: string, planId: string, idempotencyKey: string): Promise<void> {
    const response = await apiRequest<Envelope<unknown>>(`/api/dashboard/clients/${encodeURIComponent(clientId)}/visit-packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ plan_id: planId }),
    });
    if (!response?.ok) throw new Error(response?.message || 'Sale failed');
}
