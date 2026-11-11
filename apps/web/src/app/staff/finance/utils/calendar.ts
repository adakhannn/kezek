/** A date-picker value is a calendar label, never an instant in the server timezone. */
export function financeDateLabel(date: Date | string | null | undefined): string | undefined {
    if (!date) return undefined;
    if (typeof date === 'string') return date;
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}
export function financeDateValue(label: string): Date { return new Date(label + 'T12:00:00'); }
