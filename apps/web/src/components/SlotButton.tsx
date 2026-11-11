'use client';
import { useRef, useState } from 'react';

import { ToastContainer } from '@/components/ui/Toast';
import { useToast } from '@/hooks/useToast';
import { createQuickHoldBooking, QuickHoldClientError } from '@/lib/quickHoldClient';

export type QuickPayload = {
    biz_id: string;
    service_id: string;
    staff_id: string;
    start_at: string; // ISO
    slug: string;
};

export default function SlotButton({
                                       label,
                                       payload,
                                       redirectBase = '/booking',
                                   }: {
    label: string;
    payload: QuickPayload;
    redirectBase?: string;
}) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const inFlight = useRef(false);

    async function onClick() {
        if (inFlight.current) return;
        inFlight.current = true;
        setLoading(true);
        try {
            const { bookingId } = await createQuickHoldBooking({
                biz_id: payload.biz_id,
                service_id: payload.service_id,
                staff_id: payload.staff_id,
                start_at: payload.start_at,
            });
            window.location.href = `${redirectBase}/${bookingId}`;
        } catch (e) {
            if (e instanceof QuickHoldClientError && e.status === 401) {
                window.location.href = `/b/${payload.slug}`;
                return;
            }
            const msg = e instanceof Error ? e.message : String(e);
            toast.showError(msg);
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }

    return (
        <>
            <button onClick={onClick} disabled={loading} className="px-2 py-1 border rounded hover:bg-gray-100 disabled:opacity-50">
                {label}
            </button>
            <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
        </>
    );
}
