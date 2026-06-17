export type HomeBusiness = {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    phones: string[] | null;
    categories: string[] | null;
    rating_score: number | null;
};

export type HomeBooking = {
    id: string;
    start_at: string;
    end_at: string;
    status: string;
    business: {
        name: string;
        slug: string | null;
    } | null;
    branch: {
        name: string | null;
    } | null;
    service: {
        name_ru: string | null;
    } | null;
};

export type RecentPlace = {
    slug: string;
    name: string;
};

export type NearbyBranch = {
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    branchName: string;
    address: string | null;
    distanceKm: number;
};

export type NearbyStatus =
    | 'idle'
    | 'locating'
    | 'loading'
    | 'ready'
    | 'denied'
    | 'unavailable'
    | 'error';
