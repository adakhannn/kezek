/** The website's /b/<slug>/promotions page (PromotionsPageClient.tsx): grouping and texts. */
import type { Translate } from '../../i18n';
import { formatPromotionDate, type BusinessPageBranch, type BusinessPagePromotion } from './businessPageModel';

export type PromotionGroup = { branchId: string; branch: BusinessPageBranch | null; promotions: BusinessPagePromotion[] };

/** Promotions by branch, branches in the order their first promotion comes (newest first). */
export function groupPromotionsByBranch(promotions: BusinessPagePromotion[], branches: BusinessPageBranch[]): PromotionGroup[] {
    const groups = new Map<string, PromotionGroup>();
    for (const promotion of promotions) {
        let group = groups.get(promotion.branch_id);
        if (!group) {
            group = { branchId: promotion.branch_id, branch: branches.find((branch) => branch.id === promotion.branch_id) ?? null, promotions: [] };
            groups.set(promotion.branch_id, group);
        }
        group.promotions.push(promotion);
    }
    return [...groups.values()];
}

/** The detail line under the title: "Каждая 5-я услуга бесплатно" or "Скидка 10%". */
export function promotionDetail(promotion: BusinessPagePromotion, t: Translate): string | null {
    const params = promotion.params ?? {};
    if (promotion.promotion_type === 'free_after_n_visits' && typeof params.visit_count === 'number') {
        return t('parity.promotions.details.freeAfterN', { n: String(params.visit_count) });
    }
    if (
        (promotion.promotion_type === 'first_visit_discount' || promotion.promotion_type === 'birthday_discount')
        && typeof params.discount_percent === 'number'
    ) {
        return t('parity.promotions.details.discount', { percent: String(params.discount_percent) });
    }
    return null;
}

/** "Действует: 01.11.2026 — без ограничений", or null without dates. */
export function promotionPeriod(promotion: BusinessPagePromotion, t: Translate): string | null {
    if (!promotion.valid_from && !promotion.valid_to) return null;
    return t('parity.promotions.validPeriod', {
        from: formatPromotionDate(promotion.valid_from) ?? t('parity.promotions.validPeriod.from'),
        to: formatPromotionDate(promotion.valid_to) ?? t('parity.promotions.validPeriod.to'),
    });
}

export type PromotionTone = 'visits' | 'referral' | 'discount' | 'other';

export function promotionTone(type: string): PromotionTone {
    if (type === 'free_after_n_visits') return 'visits';
    if (type === 'referral_free' || type === 'referral_discount_50') return 'referral';
    if (type === 'first_visit_discount' || type === 'birthday_discount') return 'discount';
    return 'other';
}
