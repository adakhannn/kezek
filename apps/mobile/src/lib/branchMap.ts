import { Platform } from 'react-native';

export type BranchLocation = {
    lat?: number | null;
    lon?: number | null;
    address?: string | null;
    name?: string | null;
};

function hasCoordinates(place: BranchLocation): place is BranchLocation & { lat: number; lon: number } {
    return (
        typeof place.lat === 'number' &&
        typeof place.lon === 'number' &&
        Number.isFinite(place.lat) &&
        Number.isFinite(place.lon) &&
        Math.abs(place.lat) <= 90 &&
        Math.abs(place.lon) <= 180
    );
}

/** The branch can be shown on a map: coordinates, or at least an address to search for. */
export function canShowOnMap(place: BranchLocation | null | undefined): boolean {
    if (!place) return false;
    return hasCoordinates(place) || !!place.address?.trim();
}

function query(place: BranchLocation): string | null {
    if (hasCoordinates(place)) return `${place.lat},${place.lon}`;
    const address = place.address?.trim();
    return address ? address : null;
}

/**
 * The branch in the system maps app: Apple Maps on iOS, Google Maps elsewhere (the universal
 * https link opens the app when installed, the browser otherwise). Null without a location.
 */
export function branchMapUrl(place: BranchLocation, os: string = Platform.OS): string | null {
    const q = query(place);
    if (!q) return null;
    if (os === 'ios') {
        const label = place.name?.trim();
        return hasCoordinates(place)
            ? `https://maps.apple.com/?ll=${q}&q=${encodeURIComponent(label || q)}`
            : `https://maps.apple.com/?q=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Directions from the current position to the branch. Null without a location. */
export function branchDirectionsUrl(place: BranchLocation, os: string = Platform.OS): string | null {
    const q = query(place);
    if (!q) return null;
    if (os === 'ios') {
        return `https://maps.apple.com/?daddr=${encodeURIComponent(q)}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}
