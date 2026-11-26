/**
 * The Russian dictionary: the source of the key type and the fallback for a key missing elsewhere.
 * A new group is added here, in ky.ts and in en.ts.
 */
import { authRu } from './auth.ru';
import { staffRu } from './staff.ru';
import { cabinetRu } from './cabinet.ru';
import { bookingRu } from './booking.ru';
import { commonRu } from './common.ru';
import { navRu } from './nav.ru';
import { pushRu } from './push.ru';
import { discoveryRu } from './discovery.ru';
import { managerRu } from './manager.ru';
import { manageCatalogRu } from './manageCatalog.ru';
import { manageStaffRu } from './manageStaff.ru';
import { parityRu } from './parity.ru';

export const ru = {
    ...authRu,
    ...staffRu,
    ...cabinetRu,
    ...bookingRu,
    ...commonRu,
    ...navRu,
    ...pushRu,
    ...discoveryRu,
    ...managerRu,
    ...manageCatalogRu,
    ...manageStaffRu,
    ...parityRu,
} as const;

/** Every mobile dictionary key; t() accepts only these. */
export type MobileI18nKey = keyof typeof ru;

export type Dictionary = Readonly<Record<MobileI18nKey, string>>;
