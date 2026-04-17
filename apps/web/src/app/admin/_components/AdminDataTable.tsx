'use client';

import { clsx } from 'clsx';
import type { ReactNode } from 'react';

type AdminDataTableColumn = {
    key: string;
    label: ReactNode;
    align?: 'left' | 'center' | 'right';
    className?: string;
};

type AdminDataTableRow = {
    key: string;
    cells: ReactNode[];
    selected?: boolean;
    selectable?: boolean;
    onSelectChange?: (checked: boolean) => void;
};

type AdminDataTableProps = {
    columns: AdminDataTableColumn[];
    rows: AdminDataTableRow[];
    emptyState?: ReactNode;
    compact?: boolean;
    includeSelection?: boolean;
    allSelected?: boolean;
    onToggleAll?: (checked: boolean) => void;
    className?: string;
};

function alignClass(align: 'left' | 'center' | 'right' = 'left') {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
}

export function AdminDataTable({
    columns,
    rows,
    emptyState,
    compact = false,
    includeSelection = false,
    allSelected = false,
    onToggleAll,
    className,
}: AdminDataTableProps) {
    return (
        <div
            className={clsx(
                'overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]',
                className,
            )}
        >
            <div className="overflow-x-auto">
                <table className="min-w-full">
                    <thead className="bg-[var(--surface-emphasis)]">
                        <tr>
                            {includeSelection ? (
                                <th className="w-10 px-3 py-3 text-left">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={(event) => onToggleAll?.(event.target.checked)}
                                        className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--focus-ring)]"
                                    />
                                </th>
                            ) : null}
                            {columns.map((column) => (
                                <th
                                    key={column.key}
                                    className={clsx(
                                        'type-caption px-4 py-3 font-semibold uppercase tracking-wide text-[var(--text-secondary)]',
                                        alignClass(column.align),
                                        column.className,
                                    )}
                                >
                                    {column.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td
                                    colSpan={columns.length + (includeSelection ? 1 : 0)}
                                    className="px-4 py-8 text-center text-[var(--text-secondary)]"
                                >
                                    {emptyState ?? 'Нет данных'}
                                </td>
                            </tr>
                        ) : (
                            rows.map((row) => (
                                <tr
                                    key={row.key}
                                    className={clsx(
                                        'border-t border-[var(--border-subtle)]',
                                        row.selected ? 'bg-[color:color-mix(in_srgb,var(--accent-primary)_10%,transparent)]' : 'hover:bg-[var(--surface-emphasis)]',
                                    )}
                                >
                                    {includeSelection ? (
                                        <td className={clsx('px-3', compact ? 'py-2' : 'py-3')}>
                                            {row.selectable === false ? null : (
                                                <input
                                                    type="checkbox"
                                                    checked={!!row.selected}
                                                    onChange={(event) => row.onSelectChange?.(event.target.checked)}
                                                    className="h-4 w-4 rounded border-[var(--border-default)] text-[var(--accent-primary)] focus:ring-[var(--focus-ring)]"
                                                />
                                            )}
                                        </td>
                                    ) : null}
                                    {row.cells.map((cell, index) => (
                                        <td
                                            key={`${row.key}-${index}`}
                                            className={clsx(
                                                'px-4 text-[var(--text-primary)]',
                                                compact ? 'py-2.5 text-sm' : 'py-3 text-sm',
                                                alignClass(columns[index]?.align),
                                            )}
                                        >
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

