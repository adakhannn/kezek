import type { MobileI18nKey, Translate } from '../../../i18n';
import type { Promotion, PromotionType } from './catalogApi';
import { apiErrorBody } from './catalogErrors';

/** The types the website's BranchPromotionsPanel offers, in its order. */
export const PROMOTION_TYPES: { value: PromotionType; label: MobileI18nKey; description: MobileI18nKey }[] = [
    { value: 'free_after_n_visits', label: 'catalog.branches.promotions.type.freeAfterNVisits', description: 'catalog.branches.promotions.type.freeAfterNVisitsDesc' },
    { value: 'referral_free', label: 'catalog.branches.promotions.type.referralFree', description: 'catalog.branches.promotions.type.referralFreeDesc' },
    { value: 'referral_discount_50', label: 'catalog.branches.promotions.type.referralDiscount50', description: 'catalog.branches.promotions.type.referralDiscount50Desc' },
    { value: 'first_visit_discount', label: 'catalog.branches.promotions.type.firstVisitDiscount', description: 'catalog.branches.promotions.type.firstVisitDiscountDesc' },
];

export function promotionTypeLabel(type: PromotionType): MobileI18nKey | null {
    return PROMOTION_TYPES.find((item) => item.value === type)?.label ?? null;
}

export function hasDiscount(type: PromotionType): boolean {
    return type === 'birthday_discount' || type === 'first_visit_discount' || type === 'referral_discount_50';
}

export type PromotionFormState = {
    promotion_type: PromotionType;
    /** As typed; '' is "not set". */
    visit_count: string;
    discount_percent: string;
    /** Other params of an existing promotion, kept as they are. */
    extraParams: Record<string, unknown>;
    title_ru: string;
    is_active: boolean;
    valid_from: string;
    valid_to: string;
};

export function newPromotionForm(): PromotionFormState {
    return {
        promotion_type: 'free_after_n_visits',
        visit_count: '',
        discount_percent: '',
        extraParams: {},
        title_ru: '',
        is_active: true,
        valid_from: '',
        valid_to: '',
    };
}

function numberText(value: unknown): string {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

export function promotionFormFrom(promotion: Promotion): PromotionFormState {
    const { visit_count, discount_percent, ...extraParams } = promotion.params ?? {};
    return {
        promotion_type: promotion.promotion_type,
        visit_count: numberText(visit_count),
        discount_percent: numberText(discount_percent),
        extraParams,
        title_ru: promotion.title_ru,
        is_active: promotion.is_active,
        valid_from: promotion.valid_from ?? '',
        valid_to: promotion.valid_to ?? '',
    };
}

/** Switching the type resets its parameters, with the website's default discount. */
export function changePromotionType(form: PromotionFormState, type: PromotionType): PromotionFormState {
    return {
        ...form,
        promotion_type: type,
        visit_count: '',
        discount_percent: hasDiscount(type) ? (type === 'referral_discount_50' ? '50' : '20') : '',
        extraParams: {},
    };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** '' or a real calendar date as YYYY-MM-DD. */
export function isOptionalDate(value: string): boolean {
    if (value === '') return true;
    if (!DATE.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function positive(value: string): number | null {
    const number = Number(value.trim());
    return value.trim() !== '' && Number.isFinite(number) && number > 0 ? number : null;
}

/**
 * The body of POST /promotions or PATCH /promotions/[id], as the website's savePromotion: an empty
 * title becomes the type's name, and unset parameters get the defaults 7 visits, 20 % or 50 %.
 */
export function buildPromotionPayload(form: PromotionFormState, t: Translate) {
    const label = promotionTypeLabel(form.promotion_type);
    const params: Record<string, unknown> = { ...form.extraParams };
    if (form.promotion_type === 'free_after_n_visits') {
        params.visit_count = positive(form.visit_count) ?? 7;
    }
    if (hasDiscount(form.promotion_type)) {
        params.discount_percent = positive(form.discount_percent)
            ?? (form.promotion_type === 'referral_discount_50' ? 50 : 20);
    }
    return {
        promotion_type: form.promotion_type,
        params,
        title_ru: form.title_ru.trim() || (label ? t(label) : ''),
        is_active: form.is_active,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
    };
}

/** The website's promotionSaveErrorMessage: API machine codes become localized texts. */
export function promotionSaveErrorKey(error: unknown): MobileI18nKey {
    const body = apiErrorBody(error);
    if (body?.error === 'validation') {
        const field = body.details && typeof body.details === 'object' ? (body.details as { field?: unknown }).field : undefined;
        if (field === 'params.visit_count') return 'catalog.branches.promotions.validation.visitCount';
        if (field === 'params.discount_percent') return 'catalog.branches.promotions.validation.discount';
        return 'catalog.branches.promotions.validation.general';
    }
    return 'catalog.branches.promotions.error.save';
}

/** The parameter line of a promotion card ("Every 7th service is free", "20% discount"). */
export function promotionParamsText(promotion: Promotion, t: Translate): string | null {
    const params = promotion.params ?? {};
    if (promotion.promotion_type === 'free_after_n_visits') {
        return t('catalog.branches.promotions.everyNthFree', { n: String(params.visit_count || 'N') });
    }
    if (hasDiscount(promotion.promotion_type)) {
        return t('catalog.branches.promotions.discountPercent', { percent: String(params.discount_percent || 'N') });
    }
    return null;
}
