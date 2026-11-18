/**
 * Where logged warnings and errors go besides the console (ARCH-04). The Sentry setup registers
 * a reporter here when a DSN is configured; without one, nothing is sent. No SDK import: the
 * logger stays light on every runtime, and the slot is shared by all bundles of one runtime.
 */
import type { LogEvent } from '@shared-client/log';

export type MonitoringReporter = (event: LogEvent) => void;

const REPORTER_SLOT = Symbol.for('kezek.monitoring.reporter');

function slots(): Record<symbol, MonitoringReporter | undefined> {
    return globalThis as unknown as Record<symbol, MonitoringReporter | undefined>;
}

export function setMonitoringReporter(reporter?: MonitoringReporter): void {
    slots()[REPORTER_SLOT] = reporter;
}

export function dispatchToMonitoring(event: LogEvent): void {
    slots()[REPORTER_SLOT]?.(event);
}
