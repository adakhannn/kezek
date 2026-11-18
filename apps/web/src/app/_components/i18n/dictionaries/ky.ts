/**
 * Кыргызский словарь: грузится только для кыргызских страниц - из серверного layout или при смене языка (FE-06).
 */
import type { Translations } from '../LanguageProvider';

import { adminKy } from './admin.ky';
import { analyticsKy } from './analytics';
import { apiDocsKy } from './apiDocs.ky';
import { applicationHistoryKy } from './applicationHistory';
import { authKy } from './auth.ky';
import { bookingKy } from './booking.ky';
import { bookingFlowKy } from './bookingFlow';
import { bookingsKy } from './bookings.ky';
import { branchesKy } from './branches.ky';
import { businessKy } from './business.ky';
import { cabinetKy } from './cabinet.ky';
import { commonKy } from './common.ky';
import { dashboardKy } from './dashboard.ky';
import { datePickerKy } from './datePicker.ky';
import { devKy } from './dev.ky';
import { financeKy } from './finance.ky';
import { footerKy } from './footer.ky';
import { headerKy } from './header.ky';
import { homeKy } from './home.ky';
import { monthPickerKy } from './monthPicker.ky';
import { notificationsKy } from './notifications.ky';
import { scheduleFormKy } from './scheduleForm';
import { schedulingKy } from './scheduling';
import { selectBusinessKy } from './selectBusiness.ky';
import { servicesKy } from './services.ky';
import { staffKy } from './staff.ky';
import { timeRangeKy } from './timeRange.ky';

export const ky: Translations = Object.assign(
    {},
    authKy,
    bookingKy,
    bookingFlowKy,
    homeKy,
    businessKy,
    headerKy,
    dashboardKy,
    analyticsKy,
    staffKy,
    schedulingKy,
    scheduleFormKy,
    servicesKy,
    branchesKy,
    financeKy,
    adminKy,
    applicationHistoryKy,
    commonKy,
    datePickerKy,
    monthPickerKy,
    timeRangeKy,
    notificationsKy,
    bookingsKy,
    footerKy,
    cabinetKy,
    apiDocsKy,
    devKy,
    selectBusinessKy,
);
