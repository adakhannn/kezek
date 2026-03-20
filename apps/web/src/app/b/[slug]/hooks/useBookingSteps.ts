import { useMemo, useState } from 'react';

import { canProceedToNextStep, clampBookingStep } from './bookingStepRules';
import type { BookingStep, Service } from '../types';

import { logDebug } from '@/lib/log';

type UseBookingStepsParams = {
    branchId: string;
    dayStr: string;
    staffId: string;
    serviceId: string;
    servicesFiltered: Service[];
    t: (key: string, fallback?: string) => string;
    initialStep?: number;
    onStepChange?: (step: BookingStep) => void;
};

export function useBookingSteps(params: UseBookingStepsParams) {
    const { branchId, dayStr, staffId, serviceId, servicesFiltered, t, initialStep, onStepChange } = params;

    const [step, setStep] = useState<BookingStep>(clampBookingStep(initialStep));
    const totalSteps: BookingStep = 5;

    const stepsMeta = useMemo(
        () => [
            { id: 1 as BookingStep, label: t('booking.step.branch', 'Филиал') },
            { id: 2 as BookingStep, label: t('booking.step.day', 'День') },
            { id: 3 as BookingStep, label: t('booking.step.master', 'Мастер') },
            { id: 4 as BookingStep, label: t('booking.step.service', 'Услуга') },
            { id: 5 as BookingStep, label: t('booking.step.time', 'Время') },
        ],
        [t],
    );

    const canGoNext = useMemo(() => {
        const result = canProceedToNextStep({
            step,
            branchId,
            dayStr,
            staffId,
            serviceId,
            servicesFiltered,
        });

        if (step === 4 && serviceId && staffId) {
            if (!result) {
                logDebug('Booking', 'canGoNext: service not in servicesFiltered', {
                    serviceId,
                    servicesFiltered: servicesFiltered.map((service) => service.id),
                    servicesFilteredNames: servicesFiltered.map((service) => service.name_ru),
                });
            } else {
                logDebug('Booking', 'canGoNext: service is valid (in servicesFiltered)', { serviceId });
            }
        }

        return result;
    }, [step, branchId, dayStr, staffId, serviceId, servicesFiltered]);

    const canGoPrev = step > 1;

    const goPrev = () => {
        if (!canGoPrev) return;
        setStep((prev) => {
            const next = clampBookingStep(prev - 1);
            onStepChange?.(next);
            return next;
        });
    };

    const goNext = () => {
        if (!canGoNext) return;
        setStep((prev) => {
            const next = clampBookingStep(prev + 1);
            onStepChange?.(next);
            return next;
        });
    };

    return { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps };
}
