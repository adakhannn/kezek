import { formatInTimeZone } from 'date-fns-tz';

export type OwnerShiftOpenQuery = {
    targetDate: Date;
    ymd: string;
};

export function resolveOwnerShiftOpenQuery(req: Request, businessTz: string): OwnerShiftOpenQuery {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const targetDate = dateParam
        ? new Date(`${dateParam}T00:00:00`)
        : new Date();
    const ymd = formatInTimeZone(targetDate, businessTz, 'yyyy-MM-dd');

    return { targetDate, ymd };
}
