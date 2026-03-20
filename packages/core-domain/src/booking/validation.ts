/**
 * Validation for booking domain invariants.
 *
 * Payload shape/format is validated on the API boundary via Zod schemas in apps/web.
 * This module keeps only business-meaningful checks and domain helpers.
 */

import type { PromotionType, PromotionParams } from './types';

export type BranchForBookingCheck = { id: string; is_active?: boolean } | null;

export function validateBranchForBooking(branch: BranchForBookingCheck): boolean {
    if (branch == null || typeof branch !== 'object') return false;
    if (typeof branch.id !== 'string' || branch.id.trim() === '') return false;
    if (branch.is_active !== undefined && branch.is_active !== true) return false;
    return true;
}

export function validatePromotionParams(
    promotionType: PromotionType,
    params: unknown
): {
    valid: boolean;
    error?: string;
    data?: PromotionParams;
} {
    if (!params || typeof params !== 'object') {
        return { valid: false, error: 'Promotion params must be an object' };
    }

    const p = params as Record<string, unknown>;

    switch (promotionType) {
        case 'free_after_n_visits':
            if (typeof p.visit_count !== 'number' || p.visit_count <= 0) {
                return { valid: false, error: 'visit_count must be a positive number' };
            }
            return { valid: true, data: { visit_count: p.visit_count } };

        case 'birthday_discount':
        case 'first_visit_discount':
        case 'referral_discount_50':
            if (typeof p.discount_percent !== 'number' || p.discount_percent < 0 || p.discount_percent > 100) {
                return { valid: false, error: 'discount_percent must be between 0 and 100' };
            }
            return { valid: true, data: { discount_percent: p.discount_percent } };

        case 'referral_free':
            return { valid: true, data: p as PromotionParams };

        default:
            return { valid: true, data: p as PromotionParams };
    }
}

export function extractBookingId(rpcResult: unknown): string | null {
    if (typeof rpcResult === 'string') {
        return rpcResult;
    }

    if (rpcResult && typeof rpcResult === 'object') {
        const rec = rpcResult as Record<string, unknown>;
        if (typeof rec.booking_id === 'string') {
            return rec.booking_id;
        }
        if (typeof rec.id === 'string') {
            return rec.id;
        }
    }

    return null;
}
