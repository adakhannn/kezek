import { useMemo, useState } from 'react';
import * as Location from 'expo-location';
import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '../../lib/api';

import type { NearbyBranch, NearbyStatus } from './types';

const NEARBY_LIMIT = 5;
const NEARBY_RADIUS_KM = 20;
const LOCATION_TIMEOUT_MS = 8000;
const LAST_KNOWN_MAX_AGE_MS = 5 * 60 * 1000;
const LAST_KNOWN_REQUIRED_ACCURACY_M = 5000;

type ApiEnvelope<T> = {
    ok?: boolean;
    data?: T;
};

type NearbyBranchDto = {
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    branchName: string;
    address: string | null;
    distanceKm: number;
};

type Coordinates = {
    lat: number;
    lon: number;
};

function unwrapList<T>(payload: T[] | ApiEnvelope<T[]> | null | undefined): T[] {
    if (Array.isArray(payload)) {
        return payload;
    }

    if (payload && typeof payload === 'object' && Array.isArray(payload.data)) {
        return payload.data;
    }

    return [];
}

function mapNearbyBranchDto(branch: NearbyBranchDto): NearbyBranch {
    return {
        id: branch.id,
        businessId: branch.businessId,
        businessName: branch.businessName,
        businessSlug: branch.businessSlug,
        branchName: branch.branchName,
        address: branch.address,
        distanceKm: branch.distanceKm,
    };
}

async function getCurrentPositionWithTimeout() {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            }),
            new Promise<never>((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('Location request timed out'));
                }, LOCATION_TIMEOUT_MS);
            }),
        ]);
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

async function getBestAvailablePosition() {
    try {
        return await getCurrentPositionWithTimeout();
    } catch {
        return Location.getLastKnownPositionAsync({
            maxAge: LAST_KNOWN_MAX_AGE_MS,
            requiredAccuracy: LAST_KNOWN_REQUIRED_ACCURACY_M,
        });
    }
}

export function useNearbyBranches() {
    const [coords, setCoords] = useState<Coordinates | null>(null);
    const [locationState, setLocationState] = useState<NearbyStatus>('idle');

    const query = useQuery<NearbyBranch[]>({
        queryKey: ['nearby-branches', coords?.lat, coords?.lon],
        enabled: Boolean(coords),
        queryFn: async () => {
            if (!coords) {
                return [];
            }

            const params = new URLSearchParams({
                lat: String(coords.lat),
                lon: String(coords.lon),
                limit: String(NEARBY_LIMIT),
                radiusKm: String(NEARBY_RADIUS_KM),
            });

            const payload = await apiRequest<NearbyBranchDto[] | ApiEnvelope<NearbyBranchDto[]>>(
                `/api/branches/nearby?${params.toString()}`,
            );

            return unwrapList(payload).map(mapNearbyBranchDto);
        },
    });

    const requestNearbyBranches = async () => {
        if (coords) {
            await query.refetch();
            return;
        }

        setLocationState('locating');

        try {
            const servicesEnabled = await Location.hasServicesEnabledAsync();

            if (!servicesEnabled) {
                setLocationState('unavailable');
                return;
            }

            const permission = await Location.requestForegroundPermissionsAsync();

            if (permission.status !== 'granted') {
                setLocationState('denied');
                return;
            }

            const position = await getBestAvailablePosition();

            if (!position) {
                setLocationState('unavailable');
                return;
            }

            setCoords({
                lat: position.coords.latitude,
                lon: position.coords.longitude,
            });
            setLocationState('loading');
        } catch {
            setLocationState('unavailable');
        }
    };

    const nearbyStatus = useMemo<NearbyStatus>(() => {
        if (locationState === 'denied' || locationState === 'unavailable' || locationState === 'locating') {
            return locationState;
        }

        if (query.isError) {
            return 'error';
        }

        if (coords && (query.isLoading || query.isFetching)) {
            return 'loading';
        }

        if (coords) {
            return 'ready';
        }

        return 'idle';
    }, [coords, locationState, query.isError, query.isFetching, query.isLoading]);

    return {
        nearbyBranches: query.data ?? [],
        nearbyError: query.error,
        nearbyStatus,
        requestNearbyBranches,
    };
}
