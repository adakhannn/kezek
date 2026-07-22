import { useMemo, useState } from 'react';

import type { BookingStep } from '../types';
import type { Service } from '../types';

import { logDebug } from '@/lib/log';

type UseBookingStepsParams = {
    branchId: string;
    dayStr: string;
    staffId: string;
    serviceIds: string[];
    servicesFiltered: Service[];
    t: (key: string, fallback?: string) => string;
    initialStep?: number;
    onStepChange?: (step: BookingStep) => void;
};

export function useBookingSteps(params: UseBookingStepsParams) {
    const { branchId, dayStr, staffId, serviceIds, servicesFiltered, t, initialStep, onStepChange } = params;

    const [step, setStep] = useState<BookingStep>((Math.min(5, Math.max(1, initialStep ?? 1)) as BookingStep));
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

        // Шаг 4 -> 5: выбрана хотя бы одна услуга и все выбранные входят в servicesFiltered
        if (step === 4) {
            if (!staffId) return false;
            if (serviceIds.length === 0) return false;

            const filteredIds = new Set(servicesFiltered.map((s) => s.id));
            const allValid = serviceIds.every((id) => filteredIds.has(id));
            if (!allValid) {
                logDebug('Booking', 'canGoNext: not all selected services in servicesFiltered', {
                    serviceIds,
                    servicesFiltered: servicesFiltered.map((s) => s.id),
                });
                return false;
            }

            logDebug('Booking', 'canGoNext: all selected services valid (in servicesFiltered)', { serviceIds });
            return true;
        }

        return true;
    }, [step, totalSteps, branchId, dayStr, staffId, serviceIds, servicesFiltered]);

    const canGoPrev = step > 1;

    const goPrev = () => {
        if (!canGoPrev) return;
        setStep((prev) => {
            const next = Math.max(1, prev - 1) as BookingStep;
            onStepChange?.(next);
            return next;
        });
    };

    const goNext = () => {
        if (!canGoNext) return;
        setStep((prev) => {
            const next = (prev + 1 > totalSteps ? totalSteps : (prev + 1)) as BookingStep;
            onStepChange?.(next);
            return next;
        });
    };

    const goToStep = (targetStep: BookingStep) => {
        setStep((currentStep) => {
            if (targetStep < 1 || targetStep >= currentStep) return currentStep;
            onStepChange?.(targetStep);
            return targetStep;
        });
    };

    return { step, stepsMeta, canGoNext, canGoPrev, goNext, goPrev, goToStep, totalSteps };
}

