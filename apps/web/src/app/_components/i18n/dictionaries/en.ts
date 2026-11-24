/**
 * English dictionary: loaded only for English pages - from the server layout or on a locale switch (FE-06).
 */
import type { Translations } from '../LanguageProvider';

import { adminEn } from './admin.en';
import { adminAccessEn } from './adminAccess.en';
import { adminAnalyticsEn } from './adminAnalytics.en';
import { adminCatalogEn } from './adminCatalog.en';
import { adminOpsEn } from './adminOps.en';
import { analyticsEn } from './analytics';
import { apiDocsEn } from './apiDocs.en';
import { applicationHistoryEn } from './applicationHistory';
import { authEn } from './auth.en';
import { bookingEn } from './booking.en';
import { bookingFlowEn } from './bookingFlow';
import { bookingsEn } from './bookings.en';
import { branchesEn } from './branches.en';
import { businessEn } from './business.en';
import { cabinetEn } from './cabinet.en';
import { commonEn } from './common.en';
import { dashboardEn } from './dashboard.en';
import { datePickerEn } from './datePicker.en';
import { devEn } from './dev.en';
import { financeEn } from './finance.en';
import { footerEn } from './footer.en';
import { headerEn } from './header.en';
import { homeEn } from './home.en';
import { monthPickerEn } from './monthPicker.en';
import { notificationsEn } from './notifications.en';
import { scheduleFormEn } from './scheduleForm';
import { schedulingEn } from './scheduling';
import { selectBusinessEn } from './selectBusiness.en';
import { servicesEn } from './services.en';
import { staffEn } from './staff.en';
import { timeRangeEn } from './timeRange.en';

export const en: Translations = Object.assign(
    {},
    authEn,
    bookingEn,
    bookingFlowEn,
    homeEn,
    businessEn,
    headerEn,
    dashboardEn,
    analyticsEn,
    staffEn,
    schedulingEn,
    scheduleFormEn,
    servicesEn,
    branchesEn,
    financeEn,
    adminEn,
    adminAccessEn,
    adminAnalyticsEn,
    adminCatalogEn,
    adminOpsEn,
    applicationHistoryEn,
    commonEn,
    datePickerEn,
    monthPickerEn,
    timeRangeEn,
    notificationsEn,
    bookingsEn,
    footerEn,
    cabinetEn,
    apiDocsEn,
    devEn,
    selectBusinessEn,
);
