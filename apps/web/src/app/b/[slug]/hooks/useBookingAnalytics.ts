import { useCallback, useEffect } from 'react';

import { useBookingFlowStart, trackBookingFlowStep } from '@/lib/analyticsTrackEvent';
import { getSessionId, trackFunnelEvent } from '@/lib/funnelEvents';

type UseBookingAnalyticsArgs = {
    bizId: string;
};

export function useBookingAnalytics({ bizId }: UseBookingAnalyticsArgs) {
    useBookingFlowStart(bizId);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        trackFunnelEvent({
            event_type: 'business_view',
            source: 'public',
            biz_id: bizId,
            session_id: getSessionId(),
            user_agent: navigator.userAgent,
            referrer: document.referrer || null,
        });
    }, [bizId]);

    const trackBranchSelected = useCallback((branchId: string) => {
        trackBookingFlowStep({ bizId, branchId, step: 'branch' });
        trackFunnelEvent({
            event_type: 'branch_select',
            source: 'public',
            biz_id: bizId,
            branch_id: branchId,
            session_id: getSessionId(),
        });
    }, [bizId]);

    const trackDaySelected = useCallback((branchId?: string) => {
        trackBookingFlowStep({
            bizId,
            branchId: branchId || undefined,
            step: 'date',
        });
    }, [bizId]);

    const trackStaffSelected = useCallback((staffId: string, branchId?: string) => {
        trackBookingFlowStep({
            bizId,
            branchId: branchId || undefined,
            step: 'staff',
            staffId: staffId === 'any' ? null : staffId,
        });
        trackFunnelEvent({
            event_type: 'staff_select',
            source: 'public',
            biz_id: bizId,
            branch_id: branchId || null,
            staff_id: staffId === 'any' ? null : staffId,
            session_id: getSessionId(),
        });
    }, [bizId]);

    const trackServiceSelected = useCallback((serviceId: string, branchId?: string, staffId?: string) => {
        trackBookingFlowStep({
            bizId,
            branchId: branchId || undefined,
            step: 'service',
            serviceId,
        });
        trackFunnelEvent({
            event_type: 'service_select',
            source: 'public',
            biz_id: bizId,
            branch_id: branchId || null,
            service_id: serviceId,
            staff_id: staffId === 'any' ? null : staffId || null,
            session_id: getSessionId(),
        });
    }, [bizId]);

    const trackSlotSelected = useCallback((args: {
        slotTime: Date;
        branchId?: string;
        serviceId?: string;
        selectedStaffId?: string | null;
        slotStaffId?: string | null;
    }) => {
        const { slotTime, branchId, serviceId, selectedStaffId, slotStaffId } = args;

        trackBookingFlowStep({
            bizId,
            branchId: branchId || undefined,
            step: 'slot',
        });
        trackFunnelEvent({
            event_type: 'slot_select',
            source: 'public',
            biz_id: bizId,
            branch_id: branchId || null,
            service_id: serviceId || null,
            staff_id: slotStaffId || selectedStaffId === 'any' ? null : (selectedStaffId || null),
            slot_start_at: slotTime.toISOString(),
            session_id: getSessionId(),
        });
    }, [bizId]);

    return {
        trackBranchSelected,
        trackDaySelected,
        trackStaffSelected,
        trackServiceSelected,
        trackSlotSelected,
    };
}
