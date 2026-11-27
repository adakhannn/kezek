import { useEffect } from 'react';

import { isBusinessNotFoundError, useBusinessWithBranches } from '../../hooks/useBusinessWithBranches';

type Branch = {
    id: string;
    name: string;
    address?: string | null;
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
    const { data: businessData, isFetching, isLoading, error, refetch } = useBusinessWithBranches(slug) as {
        data: BusinessWithBranchesResult | undefined;
        isFetching: boolean;
        isLoading: boolean;
        error?: unknown;
        refetch?: () => unknown;
    };
    const currentBusinessData = businessData?.business.slug === slug ? businessData : undefined;

    useEffect(() => {
        if (!currentBusinessData) {
            return;
        }

        hydrateInitialData(currentBusinessData);
    }, [currentBusinessData, hydrateInitialData]);

    const failed = !currentBusinessData && !!error;
    return {
        businessData: currentBusinessData,
        isLoading: isLoading || (!currentBusinessData && !failed && isFetching),
        /** The business does not exist or is not approved. */
        isNotFound: failed && isBusinessNotFoundError(error),
        /** Loading failed for another reason (network, server): shown with a retry (B4). */
        hasError: failed && !isBusinessNotFoundError(error),
        isRetrying: failed && isFetching,
        retry: () => {
            void refetch?.();
        },
    };
}
