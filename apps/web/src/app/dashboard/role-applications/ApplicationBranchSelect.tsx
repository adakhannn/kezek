'use client';

import { Select } from '@/components/ui/Select';

type Branch = { id: string; name: string; address: string | null };

export function ApplicationBranchSelect({ id, branches, value, onChange, disabled }: {
    id: string;
    branches: Branch[];
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}) {
    const selected = branches.find((branch) => branch.id === value);
    return (
        <div className="min-w-0 space-y-2">
            <Select id={id} label="Филиал сотрудника" value={value}
                disabled={disabled} onChange={(event) => onChange(event.target.value)}
                containerClassName="min-w-0" className="min-w-0 max-w-full truncate"
                aria-describedby={selected?.address ? `${id}-address` : undefined}>
                {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
            </Select>
            {selected?.address && (
                <p id={`${id}-address`} className="break-words text-sm leading-relaxed text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                    {selected.address}
                </p>
            )}
        </div>
    );
}
