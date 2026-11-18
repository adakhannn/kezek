/**
 * Which staff card a request acts as (ARCH-02).
 *
 * A person can be an active master in several businesses: one card per business (unique
 * user_id + biz_id). Every staff screen and staff API acts as exactly one card, picked from the
 * person's active cards:
 * - an explicit choice (the card shown on screen, sent with the request) must be one of them and
 *   is never replaced by another card;
 * - a single card is used as is, and a stale remembered choice is ignored;
 * - otherwise the remembered choice, while it is still one of the cards;
 * - otherwise the person has to choose.
 */
export type StaffCardRef = {
    id: string;
    biz_id: string;
    created_at?: string | null;
};

export type StaffCardPick<T extends StaffCardRef> =
    | { status: 'none'; options: T[] }
    | { status: 'selected'; record: T; options: T[] }
    | { status: 'forbidden'; options: T[] }
    | { status: 'selection_required'; options: T[] };

/** Oldest card first, then by id: the order every chooser shows. */
export function sortStaffCards<T extends StaffCardRef>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => {
        const left = a.created_at ?? '';
        const right = b.created_at ?? '';
        if (left !== right) return left < right ? -1 : 1;
        if (a.id === b.id) return 0;
        return a.id < b.id ? -1 : 1;
    });
}

export function pickStaffCard<T extends StaffCardRef>(
    rows: readonly T[],
    choice: { explicitStaffId?: string | null; preferredStaffId?: string | null } = {},
): StaffCardPick<T> {
    const options = sortStaffCards(rows);
    if (options.length === 0) return { status: 'none', options };

    if (choice.explicitStaffId) {
        const record = options.find((row) => row.id === choice.explicitStaffId);
        return record ? { status: 'selected', record, options } : { status: 'forbidden', options };
    }
    if (options.length === 1) return { status: 'selected', record: options[0], options };

    const remembered = choice.preferredStaffId
        ? options.find((row) => row.id === choice.preferredStaffId)
        : undefined;
    return remembered
        ? { status: 'selected', record: remembered, options }
        : { status: 'selection_required', options };
}
