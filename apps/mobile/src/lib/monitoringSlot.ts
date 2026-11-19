/**
 * Where logged warnings and errors go besides the console (MOB-07). initMonitoring registers the
 * Sentry reporter here when a DSN is configured; without one, nothing is sent. No SDK import, so the
 * logger and every module that logs stay free of the Sentry SDK.
 */
import type { LogEvent, LogSink } from '@shared-client/log';

let reporter: LogSink | undefined;

export function setMonitoringReporter(next?: LogSink): void {
    reporter = next;
}

export function dispatchToMonitoring(event: LogEvent): void {
    reporter?.(event);
}
