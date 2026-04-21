import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addMinutes } from 'date-fns';

import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import type { Slot } from '@shared-client/types';

const NETWORK_ERROR_RE = /network request failed|failed to fetch|network/i;

type TimeSlot = Slot & {
    start_at: string;
    staff_id: string;
    branch_id: string;
};

type SlotsErrorKind =
    | 'MASTER_NOT_ASSIGNED'
    | 'NO_SCHEDULE'
    | 'SCHEDULE_CONFLICT'
    | 'TECHNICAL'
    | 'UNKNOWN';

type SlotsResult =
    | { ok: true; slots: TimeSlot[] }
    | { ok: false; error: { kind: SlotsErrorKind; message: string } };

type BookingDataShape = {
    business?: { id?: string | null } | null;
    serviceId?: string | null;
    selectedDate?: string | null;
    staffId?: string | null;
    branchId?: string | null;
};

function mapSlotsError(error: unknown): Extract<SlotsResult, { ok: false }> {
    const err = error as { message?: string; code?: string };
    const raw = err.message || '';

    let kind: SlotsErrorKind = 'UNKNOWN';
    let userMessage =
        'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ СЃРІРѕР±РѕРґРЅС‹Рµ СЃР»РѕС‚С‹. РџРѕРїСЂРѕР±СѓР№С‚Рµ РІС‹Р±СЂР°С‚СЊ РґСЂСѓРіРѕР№ РґРµРЅСЊ РёР»Рё РјР°СЃС‚РµСЂР°.';

    if (raw.includes('not assigned') || raw.includes('?? ?????????')) {
        kind = 'MASTER_NOT_ASSIGNED';
        userMessage =
            'РќР° РІС‹Р±СЂР°РЅРЅСѓСЋ РґР°С‚Сѓ РјР°СЃС‚РµСЂ РЅРµ РїСЂРёРєСЂРµРїР»С‘РЅ Рє СЌС‚РѕРјСѓ С„РёР»РёР°Р»Сѓ. РџРѕРїСЂРѕР±СѓР№С‚Рµ РІС‹Р±СЂР°С‚СЊ РґСЂСѓРіРѕР№ РґРµРЅСЊ РёР»Рё РјР°СЃС‚РµСЂР°.';
    } else if (raw.includes('schedule') || raw.includes('??????????')) {
        kind = 'NO_SCHEDULE';
        userMessage =
            'РЈ РІС‹Р±СЂР°РЅРЅРѕРіРѕ РјР°СЃС‚РµСЂР° РЅРµС‚ СЂР°СЃРїРёСЃР°РЅРёСЏ РЅР° РІС‹Р±СЂР°РЅРЅС‹Р№ РґРµРЅСЊ. Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ РґРµРЅСЊ.';
    } else if (raw.includes('conflict') || raw.includes('????????')) {
        kind = 'SCHEDULE_CONFLICT';
        userMessage =
            'Р•СЃС‚СЊ РєРѕРЅС„Р»РёРєС‚ РІ СЂР°СЃРїРёСЃР°РЅРёРё РјР°СЃС‚РµСЂР° РЅР° РІС‹Р±СЂР°РЅРЅС‹Р№ РґРµРЅСЊ. Р’С‹Р±РµСЂРёС‚Рµ РґСЂСѓРіРѕР№ РґРµРЅСЊ РёР»Рё РјР°СЃС‚РµСЂР°.';
    } else if (err.code === 'PGRST301' || err.code === 'PGRST116') {
        kind = 'TECHNICAL';
        userMessage =
            'РџСЂРѕРёР·РѕС€Р»Р° С‚РµС…РЅРёС‡РµСЃРєР°СЏ РѕС€РёР±РєР°. РџРѕР¶Р°Р»СѓР№СЃС‚Р°, РѕР±РЅРѕРІРёС‚Рµ СЌРєСЂР°РЅ РёР»Рё РїРѕРїСЂРѕР±СѓР№С‚Рµ РїРѕР·Р¶Рµ.';
    }

    return { ok: false, error: { kind, message: userMessage } };
}

export function useBookingStep5Slots(bookingData: BookingDataShape) {
    const { isOffline } = useNetworkStatus();
    const [hasNetworkError, setHasNetworkError] = useState(false);

    const {
        data: slotsResult,
        isLoading,
        refetch,
        error: slotsError,
    } = useQuery<SlotsResult>({
        queryKey: [
            'slots',
            bookingData.business?.id,
            bookingData.serviceId,
            bookingData.selectedDate,
            bookingData.staffId,
            bookingData.branchId,
        ],
        queryFn: async () => {
            if (
                !bookingData.business?.id ||
                !bookingData.serviceId ||
                !bookingData.selectedDate ||
                !bookingData.staffId ||
                !bookingData.branchId
            ) {
                return { ok: true, slots: [] };
            }

            try {
                const { data, error } = await supabase.rpc('get_free_slots_service_day_v2', {
                    p_biz_id: bookingData.business.id,
                    p_service_id: bookingData.serviceId,
                    p_day: bookingData.selectedDate,
                    p_per_staff: 400,
                    p_step_min: 15,
                });

                if (error) {
                    throw error;
                }

                const all = (data || []) as TimeSlot[];
                const minTime = addMinutes(new Date(), 30);

                const filtered = all.filter(
                    (slot) =>
                        slot.staff_id === bookingData.staffId &&
                        slot.branch_id === bookingData.branchId &&
                        new Date(slot.start_at) > minTime,
                );

                return { ok: true, slots: filtered };
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                if (NETWORK_ERROR_RE.test(message)) {
                    throw error;
                }

                return mapSlotsError(error);
            }
        },
        enabled:
            !!bookingData.business?.id &&
            !!bookingData.serviceId &&
            !!bookingData.staffId &&
            !!bookingData.branchId &&
            !!bookingData.selectedDate,
    });

    useEffect(() => {
        if (!slotsError) {
            setHasNetworkError(false);
            return;
        }

        const message = slotsError instanceof Error ? slotsError.message : String(slotsError);
        if (NETWORK_ERROR_RE.test(message)) {
            setHasNetworkError(true);
        }
    }, [slotsError]);

    return {
        slots: slotsResult && slotsResult.ok ? slotsResult.slots : [],
        domainErrorMessage: slotsResult && !slotsResult.ok ? slotsResult.error.message : null,
        isLoading,
        refetch,
        showOfflineBanner: isOffline || hasNetworkError,
    };
}
