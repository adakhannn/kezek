import { addDays, addWeeks, startOfWeek } from 'date-fns';

export function getWeekDates(weekOffset: number): Date[] {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const targetWeekStart = addWeeks(weekStart, weekOffset);
    return Array.from({ length: 7 }, (_, i) => addDays(targetWeekStart, i));
}
