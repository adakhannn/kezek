/**
 * Imported first by index.ts: monitoring starts before the app's own modules load, so errors while
 * they load are reported too (MOB-07).
 */
import { initMonitoring } from './monitoring';

initMonitoring();
