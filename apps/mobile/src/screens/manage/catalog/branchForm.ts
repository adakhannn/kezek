import type { MobileI18nKey } from '../../../i18n';
import type { BranchForEdit, ContactFields } from './catalogApi';

export type ContactField = keyof ContactFields;
export const CONTACT_FIELDS: ContactField[] = ['contact_phone', 'contact_whatsapp', 'contact_email', 'website_url'];

/** The branch form (the website's dashboard/branches/BranchForm.tsx); coordinates as typed. */
export type BranchFormState = {
    name: string;
    address: string;
    is_active: boolean;
    lat: string;
    lon: string;
    contact_phone: string;
    contact_whatsapp: string;
    contact_email: string;
    website_url: string;
    inherit_business_contacts: boolean;
};

export const NEW_BRANCH_FORM: BranchFormState = {
    name: '',
    address: '',
    is_active: true,
    lat: '',
    lon: '',
    contact_phone: '',
    contact_whatsapp: '',
    contact_email: '',
    website_url: '',
    inherit_business_contacts: true,
};

export function branchFormFrom(branch: BranchForEdit['branch']): BranchFormState {
    return {
        name: branch.name,
        address: branch.address ?? '',
        is_active: branch.is_active,
        lat: branch.lat == null ? '' : String(branch.lat),
        lon: branch.lon == null ? '' : String(branch.lon),
        contact_phone: branch.contact_phone ?? '',
        contact_whatsapp: branch.contact_whatsapp ?? '',
        contact_email: branch.contact_email ?? '',
        website_url: branch.website_url ?? '',
        inherit_business_contacts: branch.inherit_business_contacts !== false,
    };
}

/**
 * What a contact field shows: the branch's own value, else (while inheriting) the business's, so the
 * owner sees the number clients get. Editing the field writes the branch's own value.
 */
export function contactDisplayValue(form: BranchFormState, field: ContactField, business: ContactFields): string {
    if (form[field]) return form[field];
    if (!form.inherit_business_contacts) return '';
    return business[field] ?? '';
}

/** The hint under an empty, inherited contact field (null when the branch has its own value). */
export function contactHelperKey(form: BranchFormState, field: ContactField, business: ContactFields): MobileI18nKey | null {
    if (!form.inherit_business_contacts || form[field]) return null;
    return business[field]
        ? 'catalog.branches.form.contacts.inheritedValue'
        : 'catalog.branches.form.contacts.missingBusinessValue';
}

export type Coordinates = { lat: number | null; lon: number | null };

function coordinate(value: string): number | null | undefined {
    const raw = value.trim().replace(',', '.');
    if (raw === '') return null;
    const number = Number(raw);
    return Number.isFinite(number) ? number : undefined;
}

/** Both coordinates or neither, in range (the API's rule); null when they cannot be sent. */
export function parseCoordinates(lat: string, lon: string): Coordinates | null {
    const la = coordinate(lat);
    const lo = coordinate(lon);
    if (la === undefined || lo === undefined) return null;
    if ((la === null) !== (lo === null)) return null;
    if (la !== null && (la < -90 || la > 90)) return null;
    if (lo !== null && (lo < -180 || lo > 180)) return null;
    return { lat: la, lon: lo };
}

/**
 * The body of POST /api/branches/create or /api/branches/[id]/update: the website's fields, only the
 * keys the strict update schema accepts. Null when the coordinates are invalid.
 */
export function buildBranchPayload(form: BranchFormState) {
    const coords = parseCoordinates(form.lat, form.lon);
    if (!coords) return null;
    return {
        name: form.name.trim(),
        address: form.address.trim() || null,
        is_active: form.is_active,
        lat: coords.lat,
        lon: coords.lon,
        contact_phone: form.contact_phone,
        contact_whatsapp: form.contact_whatsapp,
        contact_email: form.contact_email,
        website_url: form.website_url,
        inherit_business_contacts: form.inherit_business_contacts,
    };
}

type GeocodedAddress = {
    city?: string | null;
    street?: string | null;
    streetNumber?: string | null;
    name?: string | null;
    formattedAddress?: string | null;
};

/** A one-line address from the phone's reverse geocoding ("Bishkek, Chui Avenue 120"); '' when unknown. */
export function formatGeocodedAddress(place: GeocodedAddress | null | undefined): string {
    if (!place) return '';
    if (place.formattedAddress?.trim()) return place.formattedAddress.trim();
    const street = [place.street, place.streetNumber].filter((part) => part && part.trim()).join(' ');
    const line = street || place.name?.trim() || '';
    return [place.city?.trim(), line].filter(Boolean).join(', ');
}

/** The point the map picker opens on: the form's coordinates when both are set and valid. */
export function mapPickerPointFrom(form: Pick<BranchFormState, 'lat' | 'lon'>): { lat: number; lon: number } | null {
    const coords = parseCoordinates(form.lat, form.lon);
    return coords?.lat != null && coords.lon != null ? { lat: coords.lat, lon: coords.lon } : null;
}

/**
 * The form after "Выбрать это место" on the map (the website's BranchMapPickerYandex onPick):
 * coordinates with 6 decimals; the address only when the geocoder found one, else the typed one stays.
 */
export function applyMapPick(
    form: BranchFormState,
    pick: { lat: number; lon: number; address: string | null },
): BranchFormState {
    const address = pick.address?.trim();
    return {
        ...form,
        lat: pick.lat.toFixed(6),
        lon: pick.lon.toFixed(6),
        ...(address ? { address } : {}),
    };
}

/** The page clients book a branch from (the website's QR code points here). */
export function branchBookingUrl(origin: string, businessSlug: string, branchId: string): string {
    return `${origin.replace(/\/+$/, '')}/b/${encodeURIComponent(businessSlug)}/booking?branch=${encodeURIComponent(branchId)}`;
}

/** The rating advice the website's BranchRatingCard shows for a score. */
export function ratingAdviceKey(score: number | null | undefined): MobileI18nKey {
    if (typeof score !== 'number') return 'catalog.branch.rating.advice.noScore';
    if (score < 60) return 'catalog.branch.rating.advice.low';
    if (score < 80) return 'catalog.branch.rating.advice.medium';
    return 'catalog.branch.rating.advice.high';
}
