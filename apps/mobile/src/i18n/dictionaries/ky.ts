import { authKy } from './auth.ky';
import { staffKy } from './staff.ky';
import { cabinetKy } from './cabinet.ky';
import { bookingKy } from './booking.ky';
import { commonKy } from './common.ky';
import { navKy } from './nav.ky';
import type { Dictionary } from './ru';

export const ky: Dictionary = {
    ...authKy,
    ...staffKy,
    ...cabinetKy,
    ...bookingKy,
    ...commonKy,
    ...navKy,
};
