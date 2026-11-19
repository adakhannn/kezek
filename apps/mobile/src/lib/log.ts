/**
 * Обёртка над shared-client логгером для mobile приложения
 * Использует __DEV__ для определения dev режима; предупреждения и ошибки также уходят в мониторинг,
 * если он включён (MOB-07, monitoring.ts).
 */

import { createLogger, maskToken, maskUrl } from '@shared-client/log';

import { dispatchToMonitoring } from './monitoringSlot';

const { logDebug, logWarn, logError } = createLogger(() => __DEV__, { sink: dispatchToMonitoring });

export { logDebug, logWarn, logError, maskToken, maskUrl };
