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
    const { data: businessData, isFetching, isLoading } = useBusinessWithBranches(
        slug,
    ) as { data: BusinessWithBranchesResult | undefined; isFetching: boolean; isLoading: boolean };
    const currentBusinessData = businessData?.business.slug === slug ? businessData : undefined;

    useEffect(() => {
        if (!currentBusinessData) {
            return;
        }

        setBusiness(currentBusinessData.business);
        setBranches(currentBusinessData.branches);

        if (currentBusinessData.branches.length === 1) {
            setBranchId(currentBusinessData.branches[0].id);
        }
    }, [currentBusinessData, setBranchId, setBranches, setBusiness]);

    return {
        businessData: currentBusinessData,
        isLoading: isLoading || (!currentBusinessData && isFetching),
    };
}
