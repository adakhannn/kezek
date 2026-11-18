/**
 * CSV for spreadsheet apps (FE-05). Quoting alone does not stop Excel, LibreOffice or Google Sheets
 * from reading a cell that begins with = + - @ (and | or %) as a formula (OWASP "CSV injection"):
 * a guest could book under the name =HYPERLINK(...) and the master's or owner's finance export
 * would run it. Such text gets a leading apostrophe and stays text. The same applies after ';',
 * because Excel with ru/ky regional settings splits rows on ';'. Numbers and phone-like values
 * (digits with + - ( ) . and spaces, which cannot call a function) and one-character placeholders
 * such as "-" are written as they are.
 */
export type CsvValue = string | number | null | undefined;

// Cells are single-line values.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]+/g;
// A formula starter (ASCII or full-width) at the start of the text or after ';', after spaces or quotes.
const FORMULA_AT_CELL_START = /(^|;)(?=[\s"]*[=+\-@|%＝＋－＠])/g;
const NUMBER_OR_PHONE = /^[+-]?[\d\s().-]*\d[\d\s().-]*$/;

export function spreadsheetSafeText(value: string): string {
    const text = value.replace(CONTROL_CHARACTERS, ' ');
    if (text.length < 2 || NUMBER_OR_PHONE.test(text)) return text;
    return text.replace(FORMULA_AT_CELL_START, "$1'");
}

export function csvCell(value: CsvValue): string {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${spreadsheetSafeText(text).replaceAll('"', '""')}"`;
}

/** Rows joined with LF; every cell quoted and made formula-safe. */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<CsvValue>>): string {
    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
