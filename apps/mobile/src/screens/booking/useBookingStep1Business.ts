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
    slug?: string;
    hydrateInitialData: (data: BusinessWithBranchesResult) => void;
};

export function useBookingStep1Business({
    slug,
    hydrateInitialData,
}: UseBookingStep1BusinessParams) {
    const { data: businessData, isFetching, isLoading } = useBusinessWithBranches(
        slug,
    ) as { data: BusinessWithBranchesResult | undefined; isFetching: boolean; isLoading: boolean };
    const currentBusinessData = businessData?.business.slug === slug ? businessData : undefined;

    useEffect(() => {
        if (!currentBusinessData) {
            return;
        }

        hydrateInitialData(currentBusinessData);
    }, [currentBusinessData, hydrateInitialData]);

    return {
        businessData: currentBusinessData,
        isLoading: isLoading || (!currentBusinessData && isFetching),
    };
}
