type BranchLike = {
    id: string;
};

export function getAutoSelectedBranchId(branches: BranchLike[]): string | null {
    return branches.length === 1 ? branches[0].id : null;
}
