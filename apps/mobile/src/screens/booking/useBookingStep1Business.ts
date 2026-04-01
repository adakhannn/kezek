import { useEffect } from 'react';

import { useBusinessWithBranches } from '../../hooks/useBusinessWithBranches';

type Branch = {
    id: string;
    name: string;
    rating_score: number | null;
};

type Business = {
    id: string;
    name: string;
    slug: string;
    rating_score: number | null;
};

type BusinessWithBranchesResult = {
    business: Business;
    branches: Branch[];
};

type UseBookingStep1BusinessParams = {
    slug: string;
    setBusiness: (business: Business) => void;
    setBranches: (branches: Branch[]) => void;
    setBranchId: (branchId: string) => void;
};

export function useBookingStep1Business({
    slug,
    setBusiness,
    setBranches,
    setBranchId,
}: UseBookingStep1BusinessParams) {
    const { data: businessData, isLoading } = useBusinessWithBranches(
        slug,
    ) as { data: BusinessWithBranchesResult | undefined; isLoading: boolean };

    useEffect(() => {
        if (!businessData) {
            return;
        }

        setBusiness(businessData.business);
        setBranches(businessData.branches);

        if (businessData.branches.length === 1) {
            setBranchId(businessData.branches[0].id);
        }
    }, [businessData, setBranchId, setBranches, setBusiness]);

    return {
        businessData,
        isLoading,
    };
}
