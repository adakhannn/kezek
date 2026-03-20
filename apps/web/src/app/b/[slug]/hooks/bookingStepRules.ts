import type { BookingStep, Service } from '../types';

export function clampBookingStep(step?: number): BookingStep {
    return Math.min(5, Math.max(1, step ?? 1)) as BookingStep;
}

type CanProceedToNextStepArgs = {
    step: BookingStep;
    branchId: string;
    dayStr: string;
    staffId: string;
    serviceId: string;
    servicesFiltered: Service[];
};

export function canProceedToNextStep({
    step,
    branchId,
    dayStr,
    staffId,
    serviceId,
    servicesFiltered,
}: CanProceedToNextStepArgs) {
    if (step >= 5) return false;
    if (step === 1) return !!branchId;
    if (step === 2) return !!dayStr;
    if (step === 3) return !!staffId;
    if (step !== 4) return true;
    if (!serviceId || !staffId) return false;
    return servicesFiltered.some((service) => service.id === serviceId);
}
