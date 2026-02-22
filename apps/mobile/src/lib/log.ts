/**
 * Обёртка над shared-client логгером для mobile приложения
 * Использует __DEV__ для определения dev режима
 */

import { createLogger, maskToken, maskUrl } from '@shared-client/log';

const { logDebug, logWarn, logError } = createLogger(() => __DEV__);

export { logDebug, logWarn, logError, maskToken, maskUrl };

