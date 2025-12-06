// apps/web/src/app/cabinet/components/BookingCard.tsx
'use client';

import {formatInTimeZone} from 'date-fns-tz';
import {useState} from 'react';

import MapDialog from './MapDialog';
import ReviewDialog from './ReviewDialog';

const TZ = process.env.NEXT_PUBLIC_TZ || 'Asia/Bishkek';

export default function BookingCard({
                                        bookingId, status, start_at, end_at,
                                        service, staff, branch, business,
                                        canCancel,
                                        review,
                                    }: {
    bookingId: string;
    status: 'hold' | 'confirmed' | 'paid' | 'cancelled';
    start_at: string;
    end_at: string;
    service: { name_ru: string; duration_min: number } | null;
    staff: { full_name: string } | null;
    branch: { name: string; lat: number | null; lon: number | null; address: string | null } | null;
    business: { name: string; slug: string } | null;
    canCancel: boolean;
    review?: { id: string; rating: number; comment: string | null } | null;
}) {
    const [showMap, setShowMap] = useState(false);
    const [openReview, setOpenReview] = useState(false);
    const [busy, setBusy] = useState(false);
    async function cancelBooking() {
        if (!confirm('Отменить запись?')) return;
        setBusy(true);
        try {
            const r = await fetch(`/api/bookings/${bookingId}/cancel`, {method: 'POST'});
            const j = await r.json();
            if (!j.ok) return alert(j.error || 'Не удалось отменить');
            location.reload();
        } finally {
            setBusy(false);
        }
    }

    const when = `${formatInTimeZone(new Date(start_at), TZ, 'dd.MM.yyyy HH:mm')} — ${formatInTimeZone(new Date(end_at), TZ, 'HH:mm')}`;

    return (
        <div className="border rounded p-3 flex flex-col gap-2">
            <div className="text-sm text-gray-600">{business?.name} • {branch?.name}</div>
            <div className="font-medium">{service?.name_ru} · {staff?.full_name}</div>
            <div className="text-sm">{when} ({TZ})</div>
            <div className="text-xs text-gray-500">Статус: {status}</div>

            <div className="flex flex-wrap gap-2 mt-1">
                <a className="border px-3 py-1 rounded" href={`/booking/${bookingId}`} target="_blank">Открыть</a>
                <button className="border px-3 py-1 rounded" onClick={() => setShowMap(true)}>Показать на карте</button>
                {canCancel && <button disabled={busy} className="border px-3 py-1 rounded"
                                      onClick={cancelBooking}>Отменить</button>}
                {!canCancel && !review &&
                    <button className="border px-3 py-1 rounded" onClick={() => setOpenReview(true)}>Оставить
                        отзыв</button>}
                {!canCancel && review && <span
                    className="text-sm">Ваш отзыв: {review.rating}★{review.comment ? ` — “${review.comment}”` : ''}</span>}
                {/* Быстрое повторение (переход к публичной записи с предзаполнением) */}
                {service && business && (
                    <a
                        className="border px-3 py-1 rounded"
                        href={`/${business.slug}?svc=${encodeURIComponent(service.name_ru)}`}
                    >Повторить</a>
                )}
            </div>

            {showMap && (
                <MapDialog
                    open={showMap}
                    onClose={() => setShowMap(false)}
                    lat={branch?.lat ?? null}
                    lon={branch?.lon ?? null}
                    title={`${business?.name ?? ''} — ${branch?.name ?? ''}`}
                    address={branch?.address ?? ''}
                />
            )}

            {openReview && (
                <ReviewDialog
                    bookingId={bookingId}
                    onClose={() => setOpenReview(false)}
                />
            )}
        </div>
    );
}
