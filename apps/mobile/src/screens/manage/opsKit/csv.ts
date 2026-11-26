/**
 * CSV for spreadsheet apps, as the website writes it (apps/web/src/lib/csv.ts, FE-05): every cell
 * quoted, and text that a spreadsheet would read as a formula (= + - @ | % at the start or after
 * ';') gets a leading apostrophe. Numbers and phone-like values stay as they are.
 */
export type CsvValue = string | number | null | undefined;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;
const FORMULA_AT_CELL_START = /(^|;)(?=[\s"]*[=+\-@|%＝＋－＠])/g;
const NUMBER_OR_PHONE = /^[+-]?[\d\s().-]*\d[\d\s().-]*$/;

export function spreadsheetSafeText(value: string): string {
    const text = value.replace(CONTROL_CHARACTERS, ' ');
    if (text.length < 2 || NUMBER_OR_PHONE.test(text)) return text;
    return text.replace(FORMULA_AT_CELL_START, "$1'");
}

export function csvCell(value: CsvValue): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${spreadsheetSafeText(text).split('"').join('""')}"`;
}

/** Rows joined with LF; every cell quoted and made formula-safe. */
export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
