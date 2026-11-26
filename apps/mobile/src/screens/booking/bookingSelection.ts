/**
 * Pure rules of the mobile booking selection, kept equal to the website's booking on /b/[slug]:
 * several services (C3), "any master" (C4), masters working at another branch that day (C5),
 * the promotion note (BookingSummary) and the create payload (useBookingCreation, useGuestBooking).
 */
import type { MobileI18nKey, Translate } from '../../i18n';
import { getPromotionTitle } from '../../utils/i18n';

/** The "any master" choice (web StaffSelector): the chosen slot's staff_id becomes the master (C4). */
export const ANY_STAFF = 'any';

export type ServiceStaffLink = { service_id: string; staff_id: string };

/** A day a master works at a branch (GET /api/public/work-locations). */
export type WorkLocation = { staff_id: string; branch_id: string; date_on: string };

/** A master working at a branch other than the home one on a day (web useTemporaryTransfers). */
export type TemporaryTransfer = { staff_id: string; branch_id: string; date: string };

type PricedService = { id: string; duration_min: number; price_from: number | null; price_to: number | null };

/** The selected services in the order of the selection; ids missing from the catalogue are dropped. */
export function pickSelectedServices<T extends { id: string }>(services: T[], serviceIds: string[]): T[] {
    return serviceIds
        .map((id) => services.find((service) => service.id === id))
        .filter((service): service is T => Boolean(service));
}

/** Total duration and price of the visit, as the web summary adds them up. */
export function summarizeServices(services: PricedService[]) {
    let durationMin = 0;
    let priceFrom = 0;
    let priceTo = 0;
    for (const service of services) {
        durationMin += service.duration_min || 0;
        if (typeof service.price_from === 'number') priceFrom += service.price_from;
        if (typeof service.price_to === 'number') priceTo += service.price_to;
    }
    return {
        durationMin,
        price_from: priceFrom > 0 ? priceFrom : null,
        price_to: priceTo > 0 ? priceTo : null,
    };
}

/**
 * Masters offered for the chosen services, by the rule the booking commands enforce
 * (_staff_performs_service): once a business links services to staff, only the masters linked
 * to every chosen service; a business without any links keeps every master.
 */
export function filterStaffForServices<T extends { id: string }>(
    staff: T[],
    links: ServiceStaffLink[],
    serviceIds: string[],
): T[] {
    if (serviceIds.length === 0 || links.length === 0) return staff;
    return staff.filter((person) =>
        serviceIds.every((serviceId) =>
            links.some((link) => link.service_id === serviceId && link.staff_id === person.id),
        ),
    );
}

/**
 * Services someone at the branch can perform, as the web booking lists them: a service linked to
 * masters is kept only when one of those masters works at the branch (staffAtBranch, see
 * staffForBranch). A business without any links keeps every service.
 */
export function servicesWithStaff<T extends { id: string }>(
    services: T[],
    links: ServiceStaffLink[],
    staffAtBranch: { id: string }[],
): T[] {
    if (links.length === 0) return services;
    const present = new Set(staffAtBranch.map((person) => person.id));
    return services.filter((service) =>
        links.some((link) => link.service_id === service.id && present.has(link.staff_id)),
    );
}

/**
 * Masters of the branch for the booking days: the home masters plus those who work at this branch
 * on one of the days (C5). A master working elsewhere only on some days stays: the day is chosen
 * later, and the slots of that day show where the master works.
 */
export function staffForBranch<T extends { id: string; branch_id: string }>(
    staff: T[],
    branchId: string,
    locations: WorkLocation[],
): T[] {
    const visiting = new Set(
        locations.filter((row) => row.branch_id === branchId).map((row) => row.staff_id),
    );
    return staff.filter((person) => person.branch_id === branchId || visiting.has(person.id));
}

/** The work locations away from a master's home branch, in the shape of @core-domain/schedule. */
export function temporaryTransfersOf(
    locations: WorkLocation[],
    staff: { id: string; branch_id: string }[],
): TemporaryTransfer[] {
    const home = new Map(staff.map((person) => [person.id, person.branch_id]));
    return locations
        .filter((row) => home.has(row.staff_id) && home.get(row.staff_id) !== row.branch_id)
        .map((row) => ({ staff_id: row.staff_id, branch_id: row.branch_id, date: row.date_on }));
}

type PromotionLike = {
    promotion_type: string;
    title_ru: string | null;
    title_ky?: string | null;
    title_en?: string | null;
    params: Record<string, unknown> | null;
};

/** The text of a branch promotion (web BookingSummary getPromotionDescription). Read-only: the server applies it. */
export function describePromotion(promotion: PromotionLike, t: Translate): string {
    const params = promotion.params || {};
    if (promotion.promotion_type === 'free_after_n_visits' && params.visit_count) {
        return t('booking.promotion.freeAfterN', { n: String(params.visit_count) });
    }
    if (
        (promotion.promotion_type === 'birthday_discount' ||
            promotion.promotion_type === 'first_visit_discount' ||
            promotion.promotion_type === 'referral_discount_50') &&
        params.discount_percent
    ) {
        return t('booking.promotion.discountPercent', { percent: String(params.discount_percent) });
    }
    return getPromotionTitle(promotion, t.locale) || t('booking.promotion.fallback');
}

export type BookingServiceItem = { service_id: string; duration_min: number; order_index: number };

export type BookingRequestPayload = {
    biz_id: string;
    branch_id: string;
    staff_id: string;
    start_at: string;
    service_id?: string;
    services?: BookingServiceItem[];
};

/**
 * The body of POST /api/quick-hold and /api/quick-book-guest: one service as service_id, several as
 * services[] with the catalogue durations in the chosen order (web useBookingCreation).
 */
export function buildBookingPayload(params: {
    bizId: string;
    branchId: string;
    staffId: string;
    startAt: string;
    services: { id: string; duration_min: number }[];
}): BookingRequestPayload {
    const base = {
        biz_id: params.bizId,
        branch_id: params.branchId,
        staff_id: params.staffId,
        start_at: params.startAt,
    };
    if (params.services.length === 1) return { ...base, service_id: params.services[0].id };
    return {
        ...base,
        services: params.services.map((service, index) => ({
            service_id: service.id,
            duration_min: service.duration_min,
            order_index: index,
        })),
    };
}

export type GuestContacts = { name: string; phone: string; email: string };

/** E.164, as the web guest form and the server check it. */
const PHONE_RE = /^\+[1-9]\d{7,14}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first problem of the guest form (web useGuestBooking), or null when it can be sent. */
export function validateGuestContacts(contacts: GuestContacts): MobileI18nKey | null {
    const name = contacts.name.trim();
    const phone = contacts.phone.trim();
    const email = contacts.email.trim();
    if (!name) return 'booking.guest.nameRequired';
    if (name.length < 2 || name.length > 100) return 'booking.guest.nameInvalid';
    if (!phone) return 'booking.guest.phoneRequired';
    if (!PHONE_RE.test(phone)) return 'booking.guest.phoneInvalid';
    if (email && (!EMAIL_RE.test(email) || email.length > 255)) return 'booking.guest.emailInvalid';
    return null;
}
