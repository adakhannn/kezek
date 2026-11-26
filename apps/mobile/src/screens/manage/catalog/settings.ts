import { BUSINESS_TIME_ZONE_OPTIONS, formatUtcOffset, isValidTimeZone } from '@shared-client/timezone';

/**
 * The zones of the website's time zone select (BusinessTimeZoneSettingsForm): the short list the
 * runtime knows, with the saved zone kept selectable when the list does not have it.
 */
export function timeZoneOptions(saved: string): string[] {
    const known = BUSINESS_TIME_ZONE_OPTIONS.filter((zone) => isValidTimeZone(zone));
    return known.includes(saved) ? known : [saved, ...known];
}

/** "Asia/Bishkek (UTC+06:00)", as the website's option text. */
export function timeZoneLabel(zone: string): string {
    return `${zone} (${formatUtcOffset(zone)})`;
}
