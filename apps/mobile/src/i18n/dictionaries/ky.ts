import { authKy } from './auth.ky';
import { staffKy } from './staff.ky';
import { cabinetKy } from './cabinet.ky';
import { bookingKy } from './booking.ky';
import { commonKy } from './common.ky';
import { navKy } from './nav.ky';
import { pushKy } from './push.ky';
import { discoveryKy } from './discovery.ky';
import { managerKy } from './manager.ky';
import { manageCatalogKy } from './manageCatalog.ky';
import { manageStaffKy } from './manageStaff.ky';
import { parityKy } from './parity.ky';
import { manageOpsKy } from './manageOps.ky';
import type { Dictionary } from './ru';

export const ky: Dictionary = {
    ...authKy,
    ...staffKy,
    ...cabinetKy,
    ...bookingKy,
    ...commonKy,
    ...navKy,
    ...pushKy,
    ...discoveryKy,
    ...managerKy,
    ...manageCatalogKy,
    ...manageStaffKy,
    ...parityKy,
    ...manageOpsKy,
};
