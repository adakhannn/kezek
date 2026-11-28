
import type { Metadata } from 'next';

import BookingLayoutClient from './BookingLayoutClient';
import NotFoundMessage from './NotFoundMessage';

import { getT } from '@/app/_components/i18n/server';
import { LoadFailedNotice } from '@/components/LoadFailedNotice';
import { logError } from '@/lib/log';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

export async function generateMetadata(): Promise<Metadata> {
    const t = await getT();
    return { title: t('booking.meta.title') };
}

export default async function BookingPage({
                                              params,
                                          }: {
    params: Promise<{ id: string }>;
}) {
    const {id} = await params;

    const supabase = await createSupabaseServerClient();

    // Пытаемся читать по RLS (клиент своей брони, сотрудник бизнеса, или супер-админ)
    const {data, error} = await supabase
        .from('bookings')
        .select(`
      id,status,start_at,end_at,promotion_applied,subscription_applied,client_id,
      services:services!bookings_service_id_fkey(name_ru, name_ky, name_en),
      staff:staff!bookings_staff_id_fkey(full_name),
      biz:businesses!bookings_biz_id_fkey(tz),
      branch:branches!bookings_branch_id_fkey(name, address),
      booking_services (
        duration_min,
        service:services (name_ru, name_ky, name_en)
      )
    `)
        .eq('id', id)
        .maybeSingle();

    // FE-08: a failed read is an error, not "booking not found".
    if (error) {
        logError('BookingPage', 'Failed to load booking', { bookingId: id, error });
        return <LoadFailedNotice page />;
    }

    // Guests use a narrow UUID-based receipt RPC, never a privileged table client.
    if (!data) {
        return <FallbackBooking id={id}/>;
    }

    const primaryService = Array.isArray(data.services) ? data.services[0] : data.services;

    type BookingServiceRow = {
        duration_min: number | null;
        service?: { name_ru?: string; name_ky?: string | null; name_en?: string | null } | null;
    };
    type BookingWithServices = typeof data & {
        booking_services?: BookingServiceRow[] | null;
    };

    const bookingWithServices = data as BookingWithServices;
    const complexServicesRaw: BookingServiceRow[] = Array.isArray(bookingWithServices.booking_services)
        ? bookingWithServices.booking_services
        : [];

    const services =
        complexServicesRaw.length > 0
            ? complexServicesRaw.map((bs) => ({
                  name_ru: bs.service?.name_ru ?? '',
                  name_ky: bs.service?.name_ky ?? null,
                  name_en: bs.service?.name_en ?? null,
                  duration_min: typeof bs.duration_min === 'number' ? bs.duration_min : null,
              }))
            : primaryService
            ? [
                  {
                      name_ru: primaryService.name_ru,
                      name_ky: primaryService.name_ky ?? null,
                      name_en: primaryService.name_en ?? null,
                      duration_min: null,
                  },
              ]
            : null;
    const master = Array.isArray(data.staff) ? data.staff[0] : data.staff;
    const biz = Array.isArray(data.biz) ? data.biz[0] : data.biz;
    const branch = Array.isArray(data.branch) ? data.branch[0] : data.branch;
    // RLS also lets the business's staff read the booking; only its client gets the client's hints.
    const { data: auth } = await supabase.auth.getUser();
    const viewer = auth?.user?.id && auth.user.id === data.client_id ? 'client' : 'staff';

    return (
            <BookingLayoutClient
                services={services}
                masterName={master?.full_name ?? '—'}
                startAt={new Date(data.start_at)}
                endAt={data.end_at ? new Date(data.end_at) : null}
                status={data.status}
                branch={branch ? { name: branch.name ?? null, address: branch.address ?? null } : null}
                promotionApplied={data.promotion_applied as Record<string, unknown> | null}
                subscriptionApplied={data.subscription_applied as Record<string, unknown> | null}
                timeZone={biz?.tz ?? null}
                viewer={viewer}
            />
    );
}

async function FallbackBooking({ id }: { id: string }) {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase.rpc('booking_receipt_public', { p_id: id });
    if (error) {
        logError('BookingPage', 'Failed to load booking receipt', { bookingId: id, error });
        return <LoadFailedNotice page />;
    }
    if (!data || data.length === 0) {
        return (
                <main className="mx-auto max-w-xl p-6">
                    <NotFoundMessage id={id} />
                </main>
        );
    }

    const row = data[0];
    // Загружаем promotion_applied отдельно, так как RPC может не возвращать его
    const { data: bookingData } = await supabase
        .from('bookings')
        .select('promotion_applied')
        .eq('id', id)
        .maybeSingle();

    return (
            <BookingLayoutClient
                services={Array.isArray(row.services) ? (row.services as Array<{ name_ru: string; name_ky: string | null; name_en: string | null; duration_min: number | null }>) : null}
                masterName={row.staff_name}
                startAt={new Date(row.start_at)}
                endAt={row.end_at ? new Date(row.end_at) : null}
                status={row.status}
                promotionApplied={(bookingData?.promotion_applied as Record<string, unknown> | null | undefined) || null}
                timeZone={row.tz ?? null}
                viewer="guest"
            />
    );
}

