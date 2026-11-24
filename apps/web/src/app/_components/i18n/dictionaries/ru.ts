/**
 * Русский словарь: входит в клиентский бандл каждой страницы и служит запасным для отсутствующих ключей (FE-06).
 */
import type { Translations } from '../LanguageProvider';

import { adminRu } from './admin.ru';
import { adminAccessRu } from './adminAccess.ru';
import { adminAnalyticsRu } from './adminAnalytics.ru';
import { adminCatalogRu } from './adminCatalog.ru';
import { adminOpsRu } from './adminOps.ru';
import { analyticsRu } from './analytics';
import { apiDocsRu } from './apiDocs.ru';
import { applicationHistoryRu } from './applicationHistory';
import { authRu } from './auth.ru';
import { bookingRu } from './booking.ru';
import { bookingFlowRu } from './bookingFlow';
import { bookingsRu } from './bookings.ru';
import { branchesRu } from './branches.ru';
import { businessRu } from './business.ru';
import { cabinetRu } from './cabinet.ru';
import { commonRu } from './common.ru';
import { dashboardRu } from './dashboard.ru';
import { datePickerRu } from './datePicker.ru';
import { devRu } from './dev.ru';
import { financeRu } from './finance.ru';
import { footerRu } from './footer.ru';
import { headerRu } from './header.ru';
import { homeRu } from './home.ru';
import { monthPickerRu } from './monthPicker.ru';
import { notificationsRu } from './notifications.ru';
import { scheduleFormRu } from './scheduleForm';
import { schedulingRu } from './scheduling';
import { selectBusinessRu } from './selectBusiness.ru';
import { servicesRu } from './services.ru';
import { staffRu } from './staff.ru';
import { timeRangeRu } from './timeRange.ru';

export const ru: Translations = Object.assign(
    {},
    authRu,
    bookingRu,
    bookingFlowRu,
    homeRu,
    businessRu,
    headerRu,
    dashboardRu,
    analyticsRu,
    staffRu,
    schedulingRu,
    scheduleFormRu,
    servicesRu,
    branchesRu,
    financeRu,
    adminRu,
    adminAccessRu,
    adminAnalyticsRu,
    adminCatalogRu,
    adminOpsRu,
    applicationHistoryRu,
    commonRu,
    datePickerRu,
    monthPickerRu,
    timeRangeRu,
    notificationsRu,
    bookingsRu,
    footerRu,
    cabinetRu,
    apiDocsRu,
    devRu,
    selectBusinessRu,
);
