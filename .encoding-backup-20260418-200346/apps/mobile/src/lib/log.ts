/**
 * Обёртка над shared-client логгером для mobile приложения
 * ?????????? __DEV__ ??? ??????????? dev ??????
 */

import { createLogger, maskToken, maskUrl } from '@shared-client/log';

const { logDebug, logWarn, logError } = createLogger(() => __DEV__);

export { logDebug, logWarn, logError, maskToken, maskUrl };

