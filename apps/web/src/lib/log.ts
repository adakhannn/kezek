/**
 * Обёртка над shared-client логгером для web приложения
 * Использует process.env.NODE_ENV для определения dev режима
 */

import { createLogger, maskToken, maskUrl } from '@shared-client/log';

const { logDebug, logWarn, logError } = createLogger(() => process.env.NODE_ENV !== 'production');

export { logDebug, logWarn, logError, maskToken, maskUrl };


