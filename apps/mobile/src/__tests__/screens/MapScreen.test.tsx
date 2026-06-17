import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import MapScreen from '../../screens/MapScreen';
import {
    buildMobileMapUrl,
    getBookingSlugFromMapUrl,
    isSameOriginMapUrl,
} from '../../screens/map/mapNavigation';

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({
        navigate: mockNavigate,
    }),
}));

jest.mock('../../lib/apiUrl', () => ({
    getMobileApiUrl: () => 'https://kezek.kg',
}));

describe('mapNavigation helpers', () => {
    test('builds mobile map URL from API origin', () => {
        expect(buildMobileMapUrl('https://kezek.kg/')).toBe('https://kezek.kg/map?mobile=1');
    });

    test('extracts booking slug from web map booking links', () => {
        expect(getBookingSlugFromMapUrl('https://kezek.kg/b/low-fade/booking')).toBe('low-fade');
        expect(getBookingSlugFromMapUrl('https://kezek.kg/ru/b/low-fade/booking?branch=1')).toBe('low-fade');
        expect(getBookingSlugFromMapUrl('https://kezek.kg/map')).toBeNull();
    });

    test('allows only same-origin map navigation as in-app map navigation', () => {
        expect(isSameOriginMapUrl('https://kezek.kg/map?mobile=1', 'https://kezek.kg/map?mobile=1')).toBe(true);
        expect(isSameOriginMapUrl('https://example.com/map', 'https://kezek.kg/map?mobile=1')).toBe(false);
    });
});

describe('MapScreen', () => {
    beforeEach(() => {
        mockNavigate.mockClear();
        jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('renders the web map inside the mobile app', () => {
        render(<MapScreen />);

        const webView = screen.getByTestId('mobile-map-webview');
        expect(webView.props.source).toEqual({ uri: 'https://kezek.kg/map?mobile=1' });
        expect(webView.props.geolocationEnabled).toBe(true);
    });

    test('intercepts web booking links and opens native booking flow', () => {
        render(<MapScreen />);

        const webView = screen.getByTestId('mobile-map-webview');
        const shouldLoad = webView.props.onShouldStartLoadWithRequest({
            url: 'https://kezek.kg/b/test-salon/booking',
        });

        expect(shouldLoad).toBe(false);
        expect(mockNavigate).toHaveBeenCalledWith('Booking', { slug: 'test-salon' });
    });

    test('intercepts SPA booking messages from the embedded web map', () => {
        render(<MapScreen />);

        const webView = screen.getByTestId('mobile-map-webview');
        webView.props.onMessage({
            nativeEvent: {
                data: JSON.stringify({
                    type: 'bookingLink',
                    url: 'https://kezek.kg/ru/b/obraz/booking?branch=branch-1',
                }),
            },
        });

        expect(mockNavigate).toHaveBeenCalledWith('Booking', { slug: 'obraz' });
    });

    test('keeps map navigation inside the WebView and opens external links outside', () => {
        render(<MapScreen />);

        const webView = screen.getByTestId('mobile-map-webview');

        expect(webView.props.onShouldStartLoadWithRequest({
            url: 'https://kezek.kg/map?categoryId=hair',
        })).toBe(true);
        expect(webView.props.onShouldStartLoadWithRequest({
            url: 'https://example.com',
        })).toBe(false);
        expect(Linking.openURL).toHaveBeenCalledWith('https://example.com');
    });

    test('shows retry state when the WebView fails', () => {
        render(<MapScreen />);

        const webView = screen.getByTestId('mobile-map-webview');
        fireEvent(webView, 'error');

        expect(screen.getByText('Не удалось загрузить карту')).toBeTruthy();
        expect(screen.getByText('Повторить')).toBeTruthy();
    });
});
