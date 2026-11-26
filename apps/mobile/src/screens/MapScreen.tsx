import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import { colors } from '../constants/colors';
import { elevation, layout, radii, space, typeScale } from '../constants/theme';
import { useLanguage } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { getMobileApiUrl } from '../lib/apiUrl';

import {
    buildMobileMapUrl,
    getBookingSlugFromMapUrl,
    isSameOriginMapUrl,
} from './map/mapNavigation';

type MapScreenNavigation = NativeStackNavigationProp<RootStackParamList, 'Map'>;

const injectedBookingLinkInterceptor = `
(() => {
    if (window.__KEZEK_MOBILE_MAP_BRIDGE__) return true;
    window.__KEZEK_MOBILE_MAP_BRIDGE__ = true;

    document.addEventListener('click', function handleKezekMapBookingClick(event) {
        let target = event.target;
        while (target && target.tagName !== 'A') {
            target = target.parentElement;
        }

        if (!target || !target.href) return;

        try {
            const url = new URL(target.href);
            if (/^\\/(?:[a-z]{2}\\/)?b\\/[^/]+\\/booking\\/?$/i.test(url.pathname)) {
                event.preventDefault();
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'bookingLink',
                    url: target.href,
                }));
            }
        } catch (_) {}
    }, true);

    return true;
})();
`;

export default function MapScreen() {
    const navigation = useNavigation<MapScreenNavigation>();
    const { t, locale } = useLanguage();
    const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const mapUrl = useMemo(() => {
        try {
            return buildMobileMapUrl(getMobileApiUrl(), locale);
        } catch {
            return null;
        }
    }, [locale]);

    const handleNavigation = useCallback(
        (request: { url: string }) => {
            if (!mapUrl) {
                return false;
            }

            const bookingSlug = getBookingSlugFromMapUrl(request.url);
            if (bookingSlug) {
                navigation.navigate('Booking', { slug: bookingSlug });
                return false;
            }

            if (isSameOriginMapUrl(request.url, mapUrl)) {
                return true;
            }

            if (/^https?:\/\//i.test(request.url)) {
                Linking.openURL(request.url);
                return false;
            }

            return true;
        },
        [mapUrl, navigation],
    );

    const openNativeBookingFromUrl = useCallback(
        (url: string) => {
            const bookingSlug = getBookingSlugFromMapUrl(url);
            if (!bookingSlug) {
                return false;
            }

            webViewRef.current?.stopLoading?.();
            navigation.navigate('Booking', { slug: bookingSlug });
            return true;
        },
        [navigation],
    );

    const handleMessage = useCallback(
        (event: WebViewMessageEvent) => {
            try {
                const message = JSON.parse(event.nativeEvent.data) as {
                    type?: string;
                    url?: string;
                };

                if (message.type === 'bookingLink' && message.url) {
                    openNativeBookingFromUrl(message.url);
                }
            } catch {
                // Ignore messages that are not produced by the map bridge.
            }
        },
        [openNativeBookingFromUrl],
    );

    const handleNavigationStateChange = useCallback(
        (state: WebViewNavigation) => {
            openNativeBookingFromUrl(state.url);
        },
        [openNativeBookingFromUrl],
    );

    const reload = useCallback(() => {
        setHasError(false);
        setIsLoading(true);
        setReloadKey((key) => key + 1);
        webViewRef.current?.reload();
    }, []);

    if (!mapUrl) {
        return (
            <View style={styles.stateContainer}>
                <EmptyState
                    icon="map-outline"
                    title={t('booking.map.unavailableTitle')}
                    message={t('booking.map.noServer')}
                />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <WebView
                key={reloadKey}
                ref={webViewRef}
                source={{ uri: mapUrl }}
                originWhitelist={['https://*', 'http://*']}
                onLoadStart={() => {
                    setIsLoading(true);
                    setHasError(false);
                }}
                onLoadEnd={() => setIsLoading(false)}
                onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                }}
                onShouldStartLoadWithRequest={handleNavigation}
                onMessage={handleMessage}
                onNavigationStateChange={handleNavigationStateChange}
                injectedJavaScriptBeforeContentLoaded={injectedBookingLinkInterceptor}
                injectedJavaScript={injectedBookingLinkInterceptor}
                javaScriptEnabled
                geolocationEnabled
                domStorageEnabled
                startInLoadingState
                testID="mobile-map-webview"
                style={styles.webView}
            />

            {isLoading ? (
                <View style={styles.loadingOverlay} pointerEvents="none">
                    <View style={styles.loadingPill} accessibilityRole="progressbar" accessibilityLabel={t('booking.map.loading')}>
                        <ActivityIndicator color={colors.tone.accent.fg} />
                        <Text style={styles.loadingText}>{t('booking.map.loading')}</Text>
                    </View>
                </View>
            ) : null}

            {hasError ? (
                <View style={styles.errorOverlay}>
                    <ErrorState
                        compact
                        title={t('booking.map.loadError')}
                        message={t('booking.checkConnection')}
                        retryLabel={t('booking.retry')}
                        onRetry={reload}
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface.page },
    webView: { flex: 1, backgroundColor: colors.surface.page },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.overlay,
    },
    loadingPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingHorizontal: space.xl,
        paddingVertical: space.md,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.card,
        ...elevation.floating,
    },
    loadingText: { ...typeScale.callout, color: colors.text.primary },
    errorOverlay: {
        position: 'absolute',
        right: layout.gutter,
        bottom: space.xxl,
        left: layout.gutter,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
        ...elevation.floating,
    },
    stateContainer: {
        flex: 1,
        justifyContent: 'center',
        padding: layout.gutter,
        backgroundColor: colors.surface.page,
    },
});
