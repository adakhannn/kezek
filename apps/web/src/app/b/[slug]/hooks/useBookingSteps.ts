import { useMemo, useState } from 'react';
import type { BookingStep } from '../types';
import type { Service } from '../types';

type UseBookingStepsParams = {
    branchId: string;
    dayStr: string;
    staffId: string;
    serviceId: string;
    servicesFiltered: Service[];
    t: (key: string, fallback?: string) => string;
};

export function useBookingSteps(params: UseBookingStepsParams) {
    const { branchId, dayStr, staffId, serviceId, servicesFiltered, t } = params;

    const [step, setStep] = useState<BookingStep>(1);
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
        if (step >= totalSteps) return false;

        // Шаг 1 -> 2: должен быть выбран филиал
        if (step === 1) return !!branchId;

        // Шаг 2 -> 3: должна быть выбрана дата
        if (step === 2) return !!dayStr;

        // Шаг 3 -> 4: должен быть выбран мастер
        if (step === 3) return !!staffId;

        // Шаг 4 -> 5: должна быть выбрана услуга И мастер должен делать эту услугу
        if (step === 4) {
            if (!serviceId || !staffId) return false;

            const isServiceValid = servicesFiltered.some((s) => s.id === serviceId);
            if (!isServiceValid) {
                const { logDebug } = await import('@/lib/log');
                logDebug('Booking', 'canGoNext: service not in servicesFiltered', {
                    serviceId,
                    servicesFiltered: servicesFiltered.map((s) => s.id),
                    servicesFilteredNames: servicesFiltered.map((s) => s.name_ru),
                });
                return false;
            }

            const { logDebug } = await import('@/lib/log');
            logDebug('Booking', 'canGoNext: service is valid (in servicesFiltered)', { serviceId });
            return true;
        }

        return true;
    }, [step, totalSteps, branchId, dayStr, staffId, serviceId, servicesFiltered]);

    const canGoPrev = step > 1;

    const goPrev = () => {
        if (!canGoPrev) return;
        setStep((prev) => (Math.max(1, prev - 1) as BookingStep));
    };

    const goNext = () => {
        if (!canGoNext) return;
        setStep((prev) => {
            const next = (prev + 1) as BookingStep;
            return (next > totalSteps ? totalSteps : next) as BookingStep;
        });
    };

    return { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, totalSteps };
}

