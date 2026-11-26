import { authEn } from './auth.en';
import { staffEn } from './staff.en';
import { cabinetEn } from './cabinet.en';
import { bookingEn } from './booking.en';
import { commonEn } from './common.en';
import { navEn } from './nav.en';
import { pushEn } from './push.en';
import { discoveryEn } from './discovery.en';
import { managerEn } from './manager.en';
import { parityEn } from './parity.en';
import type { Dictionary } from './ru';

export const en: Dictionary = {
    ...authEn,
    ...staffEn,
    ...cabinetEn,
    ...bookingEn,
    ...commonEn,
    ...navEn,
    ...pushEn,
    ...discoveryEn,
    ...managerEn,
    ...parityEn,
};
