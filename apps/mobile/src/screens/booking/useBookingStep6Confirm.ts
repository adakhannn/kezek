import { useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBooking } from '../../contexts/BookingContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirmBooking } from '../../hooks/useConfirmBooking';
import { useGuestBooking } from '../../hooks/useGuestBooking';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { useLanguage } from '../../i18n';
import { getErrorMessage, isNetworkError } from '../../lib/errors';
import { logError } from '../../lib/log';
import { RootStackParamList } from '../../navigation/types';
import { formatBookingDateLabel, formatBookingPrice } from './bookingFormat';
import {
    ANY_STAFF,
    buildBookingPayload,
    describePromotion,
    pickSelectedServices,
    summarizeServices,
    validateGuestContacts,
    type GuestContacts,
} from './bookingSelection';
import { useBookingSessionUser } from './useBookingSessionUser';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EMPTY_CONTACTS: GuestContacts = { name: '', phone: '', email: '' };

export function useBookingStep6Confirm(navigation: NavigationProp) {
    const { bookingData, reset } = useBooking();
    const { showToast } = useToast();
    const { confirm } = useConfirm();
    const { isOffline } = useNetworkStatus();
    const { locale, t } = useLanguage();
    const session = useBookingSessionUser();
    const [guestContacts, setGuestContacts] = useState<GuestContacts>(EMPTY_CONTACTS);
    const [guestError, setGuestError] = useState<string | null>(null);
    const [guestBookingId, setGuestBookingId] = useState<string | null>(null);

    const serviceIds = bookingData.serviceIds ?? (bookingData.serviceId ? [bookingData.serviceId] : []);
    const selectedServices = pickSelectedServices(bookingData.services, serviceIds);
    const selectedService = selectedServices[0];
    const total = summarizeServices(selectedServices);
    // "Any master": the master of the chosen time is the booking's master (C4).
    const bookingStaffId =
        bookingData.staffId === ANY_STAFF ? bookingData.selectedSlot?.staff_id ?? '' : bookingData.staffId;
    const selectedStaff = bookingData.staff.find((staff) => staff.id === bookingStaffId);
    const dateLabel = bookingData.selectedDate ? formatBookingDateLabel(bookingData.selectedDate, locale) : null;
    const priceLabel =
        selectedServices.length > 1 ? formatBookingPrice(total, t) : formatBookingPrice(selectedService, t);
    // Read-only, as on the website (BookingSummary): the server applies the benefits.
    const promotionNotes = bookingData.promotions
        .filter((promotion) => promotion.branch_id === bookingData.branchId)
        .map((promotion) => describePromotion(promotion, t));

    const handleFailure = (error: Error) => {
        const hasNetworkError = isOffline || isNetworkError(error);

        logError('BookingStep6Confirm', 'Create booking failed', {
            message: error.message,
            isNetworkError: hasNetworkError,
        });

        if (hasNetworkError) {
            showToast(t('booking.confirm.offlineError'), 'error');
            return;
        }

        showToast(getErrorMessage(error, t('booking.confirm.failed'), t), 'error');
    };

    const { createBooking, isPending } = useConfirmBooking({
        onSuccess: (bookingId) => {
            showToast(t('booking.confirm.created'), 'success');
            reset();
            setTimeout(() => {
                navigation.navigate('BookingDetails', { id: bookingId });
            }, 500);
        },
        onError: handleFailure,
    });

    const guest = useGuestBooking({
        onSuccess: (bookingId) => {
            showToast(t('booking.confirm.created'), 'success');
            // A guest cannot open the booking details: the screen shows the result instead.
            setGuestBookingId(bookingId);
        },
        onError: handleFailure,
    });

    const payload = () => {
        if (!bookingData.selectedSlot) {
            showToast(t('booking.confirm.selectTime'), 'error');
            return null;
        }
        if (!bookingData.business || !bookingStaffId || selectedServices.length === 0 || !bookingData.branchId) {
            showToast(t('booking.confirm.incomplete'), 'error');
            return null;
        }
        return buildBookingPayload({
            bizId: bookingData.business.id,
            branchId: bookingData.branchId,
            staffId: bookingStaffId,
            startAt: bookingData.selectedSlot.start_at,
            services: selectedServices,
        });
    };

    const handleCreateBooking = async () => {
        const body = payload();
        if (!body) {
            return;
        }

        const shouldCreate = await confirm({
            title: t('booking.confirm.title'),
            message: t('booking.confirm.message'),
            confirmLabel: t('booking.confirm.create'),
            cancelLabel: t('booking.confirm.cancel'),
        });

        if (!shouldCreate) {
            return;
        }

        createBooking(body);
    };

    const handleCreateGuestBooking = () => {
        const problem = validateGuestContacts(guestContacts);
        setGuestError(problem ? t(problem) : null);
        if (problem) {
            return;
        }
        const body = payload();
        if (!body) {
            return;
        }
        const email = guestContacts.email.trim();
        guest.createGuestBooking({
            ...body,
            client_name: guestContacts.name.trim(),
            client_phone: guestContacts.phone.trim(),
            client_email: email || null,
        });
    };

    const updateGuestContacts = (next: Partial<GuestContacts>) => {
        setGuestError(null);
        setGuestContacts((current) => ({ ...current, ...next }));
    };

    const finishGuestBooking = () => {
        reset();
        setGuestBookingId(null);
        setGuestContacts(EMPTY_CONTACTS);
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    };

    return {
        bookingData,
        selectedService,
        selectedServices,
        totalDurationMin: total.durationMin,
        selectedStaff,
        isAnyStaff: bookingData.staffId === ANY_STAFF,
        dateLabel,
        priceLabel,
        promotionNotes,
        handleCreateBooking,
        isOffline,
        isPending: isPending || guest.isPending,
        /** Null while the session is read; then signed in or a guest (C1). */
        isGuest: session.ready ? !session.userId : null,
        guestContacts,
        updateGuestContacts,
        guestError,
        handleCreateGuestBooking,
        guestBookingId,
        finishGuestBooking,
        signInInstead: () => navigation.navigate('Auth'),
    };
}
