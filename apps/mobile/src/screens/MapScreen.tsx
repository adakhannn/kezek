import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/ui/Button';
import { colors } from '../constants/colors';
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
    const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    const mapUrl = useMemo(() => {
        try {
            return buildMobileMapUrl(getMobileApiUrl());
        } catch {
            return null;
        }
    }, []);

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
                <Text style={styles.stateTitle}>Карта недоступна</Text>
                <Text style={styles.stateText}>
                    Не удалось определить адрес сервера. Проверьте конфигурацию приложения.
                </Text>
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
                    <ActivityIndicator color={colors.accent.primary} />
                    <Text style={styles.loadingText}>Загружаем карту...</Text>
                </View>
            ) : null}

            {hasError ? (
                <View style={styles.errorOverlay}>
                    <Text style={styles.stateTitle}>Не удалось загрузить карту</Text>
                    <Text style={styles.stateText}>
                        Проверьте интернет-соединение и попробуйте снова.
                    </Text>
                    <Button
                        title="Повторить"
                        onPress={reload}
                        variant="outline"
                        fullWidth
                        accessibilityLabel="Повторить загрузку карты"
                    />
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    webView: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
    loadingOverlay: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: colors.layout.space3,
        backgroundColor: colors.surface.overlay,
    },
    loadingText: {
        color: colors.text.secondary,
        fontSize: 14,
    },
    errorOverlay: {
        position: 'absolute',
        right: colors.layout.space5,
        bottom: colors.layout.space5,
        left: colors.layout.space5,
        padding: colors.layout.space5,
        borderRadius: colors.layout.radiusLg,
        borderWidth: 1,
        borderColor: colors.border.light,
        backgroundColor: colors.surface.card,
        gap: colors.layout.space3,
    },
    stateContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: colors.layout.space6,
        backgroundColor: colors.background.primary,
    },
    stateTitle: {
        color: colors.text.primary,
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    stateText: {
        color: colors.text.secondary,
        fontSize: 14,
        lineHeight: 20,
        textAlign: 'center',
    },
});
