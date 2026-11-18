/**
 * Обёртка над shared-client логгером для web приложения
 * Использует process.env.NODE_ENV для определения dev режима.
 *
 * Production (ARCH-04): на сервере (логи Vercel) ошибки и предупреждения печатаются одной строкой
 * с очищенными деталями — код ошибки, статус, сообщение БД; в браузере — только сообщение.
 * Каждое предупреждение и ошибка уходят в мониторинг (Sentry, если задан DSN).
 */

import { createLogger, maskToken, maskUrl } from '@shared-client/log';

import { dispatchToMonitoring } from './monitoring';

const onServer = () => typeof window === 'undefined';

const { logDebug, logWarn, logError } = createLogger(() => process.env.NODE_ENV !== 'production', {
    productionDetail: () => (onServer() ? 'summary' : 'message'),
    productionWarnings: onServer,
    sink: dispatchToMonitoring,
});

export { logDebug, logWarn, logError, maskToken, maskUrl };
