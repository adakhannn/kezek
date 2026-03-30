type PromotionsDebugResult = {
    client?: {
        id: string;
        email?: string;
        phone?: string;
        name?: string;
    };
    branch?: {
        id: string;
        name: string;
        biz_id: string;
    };
    biz?: {
        id: string;
        name: string;
        slug: string;
    };
    promotionUsage: Array<{
        id: string;
        promotion_id: string;
        promotion_type: string;
        booking_id: string | null;
        used_at: string;
        usage_data: unknown;
        promotion?: {
            title_ru: string;
            title_ky?: string;
            title_en?: string;
            promotion_type: string;
            params: unknown;
        };
        booking?: {
            id: string;
            start_at: string;
            end_at: string;
            status: string;
            service_id: string;
            promotion_applied: unknown;
        };
    }>;
    referrals: Array<{
        id: string;
        referrer_id: string;
        referred_id: string;
        referrer_booking_id: string | null;
        referred_booking_id: string | null;
        referrer_bonus_used: boolean;
        created_at: string;
        referrer?: {
            email?: string;
            phone?: string;
        };
        referred?: {
            email?: string;
            phone?: string;
        };
    }>;
    bookings: Array<{
        id: string;
        start_at: string;
        end_at: string;
        status: string;
        service_id: string;
        promotion_applied: unknown;
        service?: {
            name_ru: string;
        };
    }>;
    activePromotions: Array<{
        id: string;
        title_ru: string;
        promotion_type: string;
        params: unknown;
        is_active: boolean;
    }>;
    anomalies: Array<{
        type: string;
        message: string;
        severity: 'warning' | 'error';
        data?: unknown;
    }>;
};

function createEmptyResult(): PromotionsDebugResult {
    return {
        promotionUsage: [],
        referrals: [],
        bookings: [],
        activePromotions: [],
        anomalies: [],
    };
}

function appendPromotionUsageAnomalies(result: PromotionsDebugResult) {
    const usageByBooking = new Map<string, number>();
    result.promotionUsage.forEach((usage) => {
        if (usage.booking_id) {
            const key = `${usage.booking_id}-${usage.promotion_id}`;
            usageByBooking.set(key, (usageByBooking.get(key) || 0) + 1);
        }
    });

    usageByBooking.forEach((count, key) => {
        if (count > 1) {
            const [bookingId, promotionId] = key.split('-');
            result.anomalies.push({
                type: 'duplicate_usage',
                message: `Дубликат использования акции: акция ${promotionId} применена ${count} раз к бронированию ${bookingId}`,
                severity: 'error',
                data: { bookingId, promotionId, count },
            });
        }
    });

    result.promotionUsage.forEach((usage) => {
        if (usage.booking && usage.booking.status !== 'paid') {
            result.anomalies.push({
                type: 'invalid_booking_status',
                message: `Акция применена к бронированию ${usage.booking_id}, которое не в статусе 'paid' (текущий статус: ${usage.booking.status})`,
                severity: 'warning',
                data: { bookingId: usage.booking_id, status: usage.booking.status },
            });
        }

        if (usage.booking && usage.booking.promotion_applied) {
            const applied = usage.booking.promotion_applied as {
                promotion_id?: string;
                promotion_type?: string;
            };
            if (applied.promotion_id !== usage.promotion_id || applied.promotion_type !== usage.promotion_type) {
                result.anomalies.push({
                    type: 'data_mismatch',
                    message: `Несоответствие данных: в booking.promotion_applied указана акция ${applied.promotion_id}, а в client_promotion_usage - ${usage.promotion_id}`,
                    severity: 'error',
                    data: {
                        bookingId: usage.booking_id,
                        bookingPromotion: applied.promotion_id,
                        usagePromotion: usage.promotion_id,
                    },
                });
            }
        }
    });
}

function appendReferralAnomalies(result: PromotionsDebugResult) {
    result.referrals.forEach((referral) => {
        if (!referral.referrer_bonus_used && referral.referred_booking_id) {
            const referredBooking = result.bookings.find((booking) => booking.id === referral.referred_booking_id);
            if (referredBooking && referredBooking.status === 'paid') {
                result.anomalies.push({
                    type: 'unused_referral_bonus',
                    message: `Реферальный бонус не использован: реферер ${referral.referrer_id} привёл клиента ${referral.referred_id}, но бонус не использован`,
                    severity: 'warning',
                    data: {
                        referralId: referral.id,
                        referrerId: referral.referrer_id,
                        referredId: referral.referred_id,
                    },
                });
            }
        }
    });
}

async function loadClientDebugData(result: PromotionsDebugResult, serviceClient: any, clientId: string) {
    const { data: clientData } = await serviceClient
        .from('profiles')
        .select('id, email, phone, full_name')
        .eq('id', clientId)
        .single();

    if (clientData) {
        result.client = {
            id: clientData.id,
            email: clientData.email || undefined,
            phone: clientData.phone || undefined,
            name: clientData.full_name || undefined,
        };
    }

    const { data: usageData } = await serviceClient
        .from('client_promotion_usage')
        .select(
            `
            id,
            promotion_id,
            promotion_type,
            booking_id,
            used_at,
            usage_data,
            branch_promotions (
                title_ru,
                title_ky,
                title_en,
                promotion_type,
                params
            ),
            bookings (
                id,
                start_at,
                end_at,
                status,
                service_id,
                promotion_applied
            )
        `,
        )
        .eq('client_id', clientId)
        .order('used_at', { ascending: false })
        .limit(100);

    if (usageData) {
        result.promotionUsage = usageData.map((usage: any) => {
            const promotion =
                Array.isArray(usage.branch_promotions) && usage.branch_promotions.length > 0
                    ? usage.branch_promotions[0]
                    : null;
            const booking =
                Array.isArray(usage.bookings) && usage.bookings.length > 0 ? usage.bookings[0] : null;

            return {
                id: String(usage.id),
                promotion_id: String(usage.promotion_id),
                promotion_type: String(usage.promotion_type),
                booking_id: usage.booking_id ? String(usage.booking_id) : null,
                used_at: String(usage.used_at),
                usage_data: usage.usage_data,
                promotion: promotion
                    ? {
                          title_ru: String(promotion.title_ru),
                          title_ky: promotion.title_ky ? String(promotion.title_ky) : undefined,
                          title_en: promotion.title_en ? String(promotion.title_en) : undefined,
                          promotion_type: String(promotion.promotion_type),
                          params: promotion.params,
                      }
                    : undefined,
                booking: booking
                    ? {
                          id: String(booking.id),
                          start_at: String(booking.start_at),
                          end_at: String(booking.end_at),
                          status: String(booking.status),
                          service_id: String(booking.service_id),
                          promotion_applied: booking.promotion_applied,
                      }
                    : undefined,
            };
        });
    }

    const { data: referralsData } = await serviceClient
        .from('client_referrals')
        .select(
            `
            id,
            referrer_id,
            referred_id,
            referrer_booking_id,
            referred_booking_id,
            referrer_bonus_used,
            created_at,
            referrer:profiles!client_referrals_referrer_id_fkey (
                email,
                phone
            ),
            referred:profiles!client_referrals_referred_id_fkey (
                email,
                phone
            )
        `,
        )
        .or(`referrer_id.eq.${clientId},referred_id.eq.${clientId}`)
        .order('created_at', { ascending: false })
        .limit(50);

    if (referralsData) {
        result.referrals = referralsData.map((referral: any) => {
            const referrer =
                Array.isArray(referral.referrer) && referral.referrer.length > 0 ? referral.referrer[0] : null;
            const referred =
                Array.isArray(referral.referred) && referral.referred.length > 0 ? referral.referred[0] : null;

            return {
                id: String(referral.id),
                referrer_id: String(referral.referrer_id),
                referred_id: String(referral.referred_id),
                referrer_booking_id: referral.referrer_booking_id
                    ? String(referral.referrer_booking_id)
                    : null,
                referred_booking_id: referral.referred_booking_id
                    ? String(referral.referred_booking_id)
                    : null,
                referrer_bonus_used: Boolean(referral.referrer_bonus_used),
                created_at: String(referral.created_at),
                referrer: referrer
                    ? {
                          email: referrer.email ? String(referrer.email) : undefined,
                          phone: referrer.phone ? String(referrer.phone) : undefined,
                      }
                    : undefined,
                referred: referred
                    ? {
                          email: referred.email ? String(referred.email) : undefined,
                          phone: referred.phone ? String(referred.phone) : undefined,
                      }
                    : undefined,
            };
        });
    }

    const { data: bookingsData } = await serviceClient
        .from('bookings')
        .select(
            `
            id,
            start_at,
            end_at,
            status,
            service_id,
            promotion_applied,
            services (
                name_ru
            )
        `,
        )
        .eq('client_id', clientId)
        .not('promotion_applied', 'is', null)
        .order('start_at', { ascending: false })
        .limit(50);

    if (bookingsData) {
        result.bookings = bookingsData.map((booking: any) => {
            const service =
                Array.isArray(booking.services) && booking.services.length > 0 ? booking.services[0] : null;
            return {
                id: String(booking.id),
                start_at: String(booking.start_at),
                end_at: String(booking.end_at),
                status: String(booking.status),
                service_id: String(booking.service_id),
                promotion_applied: booking.promotion_applied,
                service: service
                    ? {
                          name_ru: String(service.name_ru),
                      }
                    : undefined,
            };
        });
    }
}

async function loadBranchDebugData(result: PromotionsDebugResult, serviceClient: any, branchId: string) {
    const { data: branchData } = await serviceClient
        .from('branches')
        .select('id, name, biz_id')
        .eq('id', branchId)
        .single();

    if (!branchData) {
        return;
    }

    result.branch = {
        id: branchData.id,
        name: branchData.name,
        biz_id: branchData.biz_id,
    };

    const { data: promotionsData } = await serviceClient
        .from('branch_promotions')
        .select('id, title_ru, promotion_type, params, is_active')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false });

    if (promotionsData) {
        result.activePromotions = promotionsData.map((promotion: any) => ({
            id: promotion.id,
            title_ru: promotion.title_ru,
            promotion_type: promotion.promotion_type,
            params: promotion.params,
            is_active: promotion.is_active,
        }));
    }
}

async function loadBizDebugData(result: PromotionsDebugResult, serviceClient: any, bizId: string) {
    const { data: bizData } = await serviceClient
        .from('businesses')
        .select('id, name, slug')
        .eq('id', bizId)
        .single();

    if (bizData) {
        result.biz = {
            id: bizData.id,
            name: bizData.name,
            slug: bizData.slug,
        };
    }
}

export async function loadPromotionsDebugData(params: {
    serviceClient: any;
    clientId: string | null;
    branchId: string | null;
    bizId: string | null;
}) {
    const { serviceClient, clientId, branchId, bizId } = params;
    const result = createEmptyResult();

    if (clientId) {
        await loadClientDebugData(result, serviceClient, clientId);
    }

    if (branchId) {
        await loadBranchDebugData(result, serviceClient, branchId);
    }

    if (bizId) {
        await loadBizDebugData(result, serviceClient, bizId);
    }

    if (result.promotionUsage.length > 0) {
        appendPromotionUsageAnomalies(result);
    }

    appendReferralAnomalies(result);
    return result;
}
