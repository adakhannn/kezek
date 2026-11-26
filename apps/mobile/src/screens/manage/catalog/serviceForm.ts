import { validateName } from '@shared-client/validation';

import type { Translate } from '../../../i18n';
import type { ServiceForEdit } from './catalogApi';

/** The service form (the website's dashboard/services/ServiceForm.tsx); numbers are kept as typed. */
export type ServiceFormState = {
    name_ru: string;
    name_ky: string;
    name_en: string;
    duration_min: string;
    price_from: string;
    price_to: string;
    active: boolean;
    branch_ids: string[];
};

export type ServiceField = 'nameRu' | 'nameKy' | 'nameEn' | 'duration' | 'priceFrom' | 'priceTo' | 'branches';
export type ServiceFieldErrors = Partial<Record<ServiceField, string>>;

/** A new service: 60 minutes, active, no branch yet (as /dashboard/services/new). */
export const NEW_SERVICE_FORM: ServiceFormState = {
    name_ru: '',
    name_ky: '',
    name_en: '',
    duration_min: '60',
    price_from: '',
    price_to: '',
    active: true,
    branch_ids: [],
};

export function serviceFormFrom(data: ServiceForEdit): ServiceFormState {
    const { service } = data;
    return {
        name_ru: service.name_ru,
        name_ky: service.name_ky ?? '',
        name_en: service.name_en ?? '',
        duration_min: service.duration_min > 0 ? String(service.duration_min) : '',
        price_from: service.price_from === 0 ? '' : String(service.price_from),
        price_to: service.price_to === 0 ? '' : String(service.price_to),
        active: service.active,
        branch_ids: data.serviceBranchIds,
    };
}

/** "007" -> "7", as the website's duration input. */
export function normalizeDurationInput(value: string): string {
    return value.replace(/^0+(?=\d)/, '');
}

function priceOf(value: string): number {
    const raw = value.trim().replace(',', '.');
    return raw === '' ? 0 : Number(raw);
}

/** The website's checks with its texts; an empty object when the form can be sent. */
export function validateServiceForm(form: ServiceFormState, t: Translate): ServiceFieldErrors {
    const errors: ServiceFieldErrors = {};
    const nameRu = form.name_ru.trim();
    const nameKy = form.name_ky.trim();
    const nameEn = form.name_en.trim();
    const duration = Number(form.duration_min.trim());
    const priceFrom = priceOf(form.price_from);
    const priceTo = priceOf(form.price_to);

    if (!nameRu) errors.nameRu = t('catalog.services.form.error.nameRequired');
    else if (!validateName(nameRu).valid) errors.nameRu = t('catalog.services.form.error.nameRuInvalid');
    if (nameKy && !validateName(nameKy, false).valid) errors.nameKy = t('catalog.services.form.error.nameKyInvalid');
    if (nameEn && !validateName(nameEn, false).valid) errors.nameEn = t('catalog.services.form.error.nameEnInvalid');
    if (form.duration_min.trim() === '' || !Number.isInteger(duration) || duration < 1) {
        errors.duration = t('catalog.services.form.error.durationInvalid');
    }
    if (!Number.isFinite(priceFrom) || priceFrom < 0) errors.priceFrom = t('catalog.services.form.error.priceInvalid');
    if (!Number.isFinite(priceTo) || priceTo < 0) errors.priceTo = t('catalog.services.form.error.priceInvalid');
    if (!errors.priceFrom && !errors.priceTo && priceFrom > 0 && priceTo > 0 && priceFrom > priceTo) {
        errors.priceTo = t('catalog.services.form.error.priceRangeInvalid');
    }
    if (form.branch_ids.length === 0) errors.branches = t('catalog.services.form.error.branchRequired');
    return errors;
}

/** The body of POST /api/services/create or /api/services/[id]/update (as the website sends it). */
export function buildServicePayload(form: ServiceFormState, serviceId?: string) {
    return {
        name_ru: form.name_ru.trim(),
        name_ky: form.name_ky.trim() || null,
        name_en: form.name_en.trim() || null,
        duration_min: Number(form.duration_min.trim()),
        price_from: priceOf(form.price_from),
        price_to: priceOf(form.price_to),
        active: form.active,
        ...(serviceId ? { service_id: serviceId } : {}),
        branch_ids: form.branch_ids,
    };
}

export function toggleId(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

/** "Select all" when not every branch is chosen, otherwise "clear all". */
export function toggleAllIds(ids: string[], all: string[]): string[] {
    return all.length > 0 && ids.length === all.length ? [] : [...all];
}
