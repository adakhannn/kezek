import {
    validateEmail,
    validateName,
    validatePercent,
    validatePercentSum,
    validatePhone,
    validatePositiveNumber,
} from '@shared-client/validation';

import type { MobileI18nKey } from '../../i18n';
import type { StaffUpdateBody } from './api';
import type { StaffCard, StaffRow } from './types';

/** The website's StaffForm fields; numbers are kept as typed text until saving. */
export type StaffFormState = {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    branch_id: string;
    is_active: boolean;
    percent_master: string;
    percent_salon: string;
    hourly_rate: string;
};

export function staffFormFromCard(staff: StaffCard): StaffFormState {
    const master = Number(staff.percent_master ?? 60);
    const salon = Number(staff.percent_salon ?? 40);
    return {
        id: staff.id,
        full_name: staff.full_name,
        email: staff.email ?? '',
        phone: staff.phone ?? '',
        branch_id: staff.branch_id,
        is_active: staff.is_active,
        percent_master: String(master),
        percent_salon: String(salon),
        hourly_rate: staff.hourly_rate !== null && staff.hourly_rate !== undefined ? String(staff.hourly_rate) : '',
    };
}

/** Typing one share sets the other to the rest of 100, as on the website. */
export function withMasterPercent(form: StaffFormState, value: string): StaffFormState {
    const master = Number(value) || 0;
    return { ...form, percent_master: value, percent_salon: String(100 - master) };
}

export function withSalonPercent(form: StaffFormState, value: string): StaffFormState {
    const salon = Number(value) || 0;
    return { ...form, percent_salon: value, percent_master: String(100 - salon) };
}

const decimal = (value: string) => value.trim().replace(',', '.');

export type StaffFormResult = { ok: true; body: StaffUpdateBody } | { ok: false; error: MobileI18nKey };

/**
 * The website's StaffForm checks, in its order (shared-client validation rules), and the body it
 * posts to /api/staff/[id]/update. An empty email or phone is sent as null; an empty hourly rate
 * means "percent of revenue only".
 */
export function validateStaffForm(form: StaffFormState): StaffFormResult {
    const name = validateName(form.full_name);
    if (!name.valid) {
        return { ok: false, error: form.full_name.trim() ? 'manageStaff.form.nameLength' : 'manageStaff.staff.form.errors.nameRequired' };
    }
    if (!form.branch_id) return { ok: false, error: 'manageStaff.staff.form.errors.branchRequired' };
    if (form.email.trim() && !validateEmail(form.email).valid) return { ok: false, error: 'manageStaff.staff.form.errors.emailInvalid' };
    if (form.phone.trim() && !validatePhone(form.phone, false).valid) return { ok: false, error: 'manageStaff.staff.form.errors.phoneInvalid' };

    const master = form.percent_master.trim() === '' ? 60 : Number(decimal(form.percent_master));
    const salon = form.percent_salon.trim() === '' ? 40 : Number(decimal(form.percent_salon));
    if (!validatePercent(master).valid) return { ok: false, error: 'manageStaff.staff.form.errors.percentMasterInvalid' };
    if (!validatePercent(salon).valid) return { ok: false, error: 'manageStaff.staff.form.errors.percentSalonInvalid' };
    if (!validatePercentSum(master, salon).valid) return { ok: false, error: 'manageStaff.staff.form.errors.percentSumInvalid' };

    let hourlyRate: number | null = null;
    // The website keeps `Number(value) || null`: 0 or an unreadable number clears the rate.
    if (form.hourly_rate.trim() !== '') {
        hourlyRate = Number(decimal(form.hourly_rate)) || null;
        if (hourlyRate !== null && !validatePositiveNumber(hourlyRate, { min: 0, allowZero: false }).valid) {
            return { ok: false, error: 'manageStaff.staff.form.errors.hourlyRateInvalid' };
        }
    }

    return {
        ok: true,
        body: {
            id: form.id,
            full_name: form.full_name,
            email: form.email.trim() ? form.email : null,
            phone: form.phone.trim() ? form.phone : null,
            branch_id: form.branch_id,
            is_active: form.is_active,
            percent_master: master,
            percent_salon: salon,
            hourly_rate: hourlyRate,
        },
    };
}

export type StaffStatusFilter = 'all' | 'active' | 'inactive';

/** The website's list: 30 cards a page. */
export const STAFF_PAGE_SIZE = 30;

/** Search by name and the status filter of /dashboard/staff. */
export function filterStaffRows(rows: StaffRow[], query: string, status: StaffStatusFilter): StaffRow[] {
    let result = rows;
    const normalized = query.toLowerCase().trim();
    if (normalized) result = result.filter((row) => row.full_name.toLowerCase().includes(normalized));
    if (status === 'active') result = result.filter((row) => row.is_active === true);
    else if (status === 'inactive') result = result.filter((row) => row.is_active !== true);
    return result;
}

export function staffCounts(rows: StaffRow[]) {
    const active = rows.filter((row) => row.is_active === true).length;
    return { active, inactive: rows.length - active, total: rows.length };
}

/** Initials of the avatar circle: first letters of the first two words, '??' when none. */
export function staffInitials(fullName: string): string {
    return fullName.split(' ').map((part) => part[0] ?? '').join('').toUpperCase().slice(0, 2) || '??';
}

export function pageOf<T>(items: T[], page: number, size = STAFF_PAGE_SIZE) {
    const totalPages = Math.max(1, Math.ceil(items.length / size));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * size;
    return { items: items.slice(start, start + size), page: current, totalPages, from: items.length ? start + 1 : 0, to: Math.min(start + size, items.length) };
}
