import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { createErrorResponse, createSuccessResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { getServiceClient } from '@/lib/supabaseService';

export async function GET(request: Request) {
    return withErrorHandler('PromotionsDebug', async () => {
        const cookieStore = await cookies();
        const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                set: () => {},
                remove: () => {},
            },
        });

        // Проверяем, что пользователь - суперадмин
        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        // Проверяем, что пользователь - суперадмин
        const { data: roleData } = await supabase
            .from('user_roles')
            .select('roles!inner(key)')
            .eq('user_id', user.id)
            .eq('roles.key', 'super_admin')
            .single();

        if (!roleData) {
            return createErrorResponse('forbidden', 'Доступ запрещен: только для суперадмина', undefined, 403);
        }

        const { searchParams } = new URL(request.url);
        const clientId = searchParams.get('clientId');
        const branchId = searchParams.get('branchId');
        const bizId = searchParams.get('bizId');

        if (!clientId && !branchId && !bizId) {
            return createErrorResponse('validation', 'Требуется clientId, branchId или bizId', undefined, 400);
        }

        // Валидация UUID параметров для предотвращения SQL injection
        if (clientId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
            return createErrorResponse('validation', 'Неверный формат clientId (требуется UUID)', undefined, 400);
        }
        if (branchId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchId)) {
            return createErrorResponse('validation', 'Неверный формат branchId (требуется UUID)', undefined, 400);
        }
        if (bizId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bizId)) {
            return createErrorResponse('validation', 'Неверный формат bizId (требуется UUID)', undefined, 400);
        }

        const serviceClient = getServiceClient();

        // Собираем данные для отладки
        const result: {
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
        } = {
            promotionUsage: [],
            referrals: [],
            bookings: [],
            activePromotions: [],
            anomalies: [],
        };

        // Получаем информацию о клиенте
        if (clientId) {
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

            // Получаем историю использования акций
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
                `
                )
                .eq('client_id', clientId)
                .order('used_at', { ascending: false })
                .limit(100);

            if (usageData) {
                type UsageRow = {
                    id: unknown;
                    promotion_id: unknown;
                    promotion_type: unknown;
                    booking_id: unknown;
                    used_at: unknown;
                    usage_data: unknown;
                    branch_promotions?: Array<{
                        title_ru: unknown;
                        title_ky?: unknown;
                        title_en?: unknown;
                        promotion_type: unknown;
                        params: unknown;
                    }> | null;
                    bookings?: Array<{
                        id: unknown;
                        start_at: unknown;
                        end_at: unknown;
                        status: unknown;
                        service_id: unknown;
                        promotion_applied: unknown;
                    }> | null;
                };

                result.promotionUsage = usageData.map((u: UsageRow) => {
                    const promotion = Array.isArray(u.branch_promotions) && u.branch_promotions.length > 0
                        ? u.branch_promotions[0]
                        : null;
                    const booking = Array.isArray(u.bookings) && u.bookings.length > 0
                        ? u.bookings[0]
                        : null;

                    return {
                        id: String(u.id),
                        promotion_id: String(u.promotion_id),
                        promotion_type: String(u.promotion_type),
                        booking_id: u.booking_id ? String(u.booking_id) : null,
                        used_at: String(u.used_at),
                        usage_data: u.usage_data,
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

            // Получаем реферальные связи
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
                `
                )
                .or(`referrer_id.eq.${clientId},referred_id.eq.${clientId}`)
                .order('created_at', { ascending: false })
                .limit(50);

            if (referralsData) {
                type ReferralRow = {
                    id: unknown;
                    referrer_id: unknown;
                    referred_id: unknown;
                    referrer_booking_id: unknown;
                    referred_booking_id: unknown;
                    referrer_bonus_used: unknown;
                    created_at: unknown;
                    referrer?: Array<{
                        email?: unknown;
                        phone?: unknown;
                    }> | null;
                    referred?: Array<{
                        email?: unknown;
                        phone?: unknown;
                    }> | null;
                };

                result.referrals = referralsData.map((r: ReferralRow) => {
                    const referrer = Array.isArray(r.referrer) && r.referrer.length > 0
                        ? r.referrer[0]
                        : null;
                    const referred = Array.isArray(r.referred) && r.referred.length > 0
                        ? r.referred[0]
                        : null;

                    return {
                        id: String(r.id),
                        referrer_id: String(r.referrer_id),
                        referred_id: String(r.referred_id),
                        referrer_booking_id: r.referrer_booking_id ? String(r.referrer_booking_id) : null,
                        referred_booking_id: r.referred_booking_id ? String(r.referred_booking_id) : null,
                        referrer_bonus_used: Boolean(r.referrer_bonus_used),
                        created_at: String(r.created_at),
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

            // Получаем бронирования с применёнными акциями
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
                `
                )
                .eq('client_id', clientId)
                .not('promotion_applied', 'is', null)
                .order('start_at', { ascending: false })
                .limit(50);

            if (bookingsData) {
                type BookingRow = {
                    id: unknown;
                    start_at: unknown;
                    end_at: unknown;
                    status: unknown;
                    service_id: unknown;
                    promotion_applied: unknown;
                    services?: Array<{
                        name_ru: unknown;
                    }> | null;
                };

                result.bookings = bookingsData.map((b: BookingRow) => {
                    const service = Array.isArray(b.services) && b.services.length > 0
                        ? b.services[0]
                        : null;

                    return {
                        id: String(b.id),
                        start_at: String(b.start_at),
                        end_at: String(b.end_at),
                        status: String(b.status),
                        service_id: String(b.service_id),
                        promotion_applied: b.promotion_applied,
                        service: service
                            ? {
                                  name_ru: String(service.name_ru),
                              }
                            : undefined,
                    };
                });
            }
        }

        // Получаем информацию о филиале
        if (branchId) {
            const { data: branchData } = await serviceClient
                .from('branches')
                .select('id, name, biz_id')
                .eq('id', branchId)
                .single();

            if (branchData) {
                result.branch = {
                    id: branchData.id,
                    name: branchData.name,
                    biz_id: branchData.biz_id,
                };

                // Получаем активные акции филиала
                const { data: promotionsData } = await serviceClient
                    .from('branch_promotions')
                    .select('id, title_ru, promotion_type, params, is_active')
                    .eq('branch_id', branchId)
                    .order('created_at', { ascending: false });

                if (promotionsData) {
                    result.activePromotions = promotionsData.map((p) => ({
                        id: p.id,
                        title_ru: p.title_ru,
                        promotion_type: p.promotion_type,
                        params: p.params,
                        is_active: p.is_active,
                    }));
                }
            }
        }

        // Получаем информацию о бизнесе
        if (bizId) {
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

        // Проверяем на аномалии
        if (result.promotionUsage.length > 0) {
            // Проверка 1: Дубликаты использования одной акции для одного бронирования
            const usageByBooking = new Map<string, number>();
            result.promotionUsage.forEach((u) => {
                if (u.booking_id) {
                    const key = `${u.booking_id}-${u.promotion_id}`;
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

            // Проверка 2: Использование акции для бронирования, которое не в статусе 'paid'
            result.promotionUsage.forEach((u) => {
                if (u.booking && u.booking.status !== 'paid') {
                    result.anomalies.push({
                        type: 'invalid_booking_status',
                        message: `Акция применена к бронированию ${u.booking_id}, которое не в статусе 'paid' (текущий статус: ${u.booking.status})`,
                        severity: 'warning',
                        data: { bookingId: u.booking_id, status: u.booking.status },
                    });
                }
            });

            // Проверка 3: Несоответствие между promotion_applied в booking и записью в client_promotion_usage
            result.promotionUsage.forEach((u) => {
                if (u.booking && u.booking.promotion_applied) {
                    const applied = u.booking.promotion_applied as { promotion_id?: string; promotion_type?: string };
                    if (applied.promotion_id !== u.promotion_id || applied.promotion_type !== u.promotion_type) {
                        result.anomalies.push({
                            type: 'data_mismatch',
                            message: `Несоответствие данных: в booking.promotion_applied указана акция ${applied.promotion_id}, а в client_promotion_usage - ${u.promotion_id}`,
                            severity: 'error',
                            data: {
                                bookingId: u.booking_id,
                                bookingPromotion: applied.promotion_id,
                                usagePromotion: u.promotion_id,
                            },
                        });
                    }
                }
            });
        }

        // Проверка 4: Реферальные связи без использованного бонуса
        result.referrals.forEach((r) => {
            if (!r.referrer_bonus_used && r.referred_booking_id) {
                // Проверяем, что реферал действительно оплатил услугу
                const referredBooking = result.bookings.find((b) => b.id === r.referred_booking_id);
                if (referredBooking && referredBooking.status === 'paid') {
                    result.anomalies.push({
                        type: 'unused_referral_bonus',
                        message: `Реферальный бонус не использован: реферер ${r.referrer_id} привёл клиента ${r.referred_id}, но бонус не использован`,
                        severity: 'warning',
                        data: { referralId: r.id, referrerId: r.referrer_id, referredId: r.referred_id },
                    });
                }
            }
        });

        return createSuccessResponse(result);
    });
}

