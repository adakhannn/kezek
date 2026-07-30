export function normalizeBusinessNameForMatch(value: string): string {
    return value
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase('ru');
}
