import React, { useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Linking, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent } from 'react-native-webview';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import Button from '../../../../components/ui/Button';
import EmptyState from '../../../../components/ui/EmptyState';
import ErrorState from '../../../../components/ui/ErrorState';
import FeedbackBanner from '../../../../components/ui/FeedbackBanner';
import Input from '../../../../components/ui/Input';
import MotionPressable from '../../../../components/ui/MotionPressable';
import { MIN_TOUCH_TARGET } from '../../../../constants/accessibility';
import { colors } from '../../../../constants/colors';
import { elevation, layout, radii, space, typeScale } from '../../../../constants/theme';
import { useNetworkStatus } from '../../../../hooks/useNetworkStatus';
import { useLanguage } from '../../../../i18n';
import { getMobileApiUrl } from '../../../../lib/apiUrl';
import {
    buildMapPickerCommand,
    initialMapPickerState,
    mapPickerReducer,
    mapPickerResult,
    parseMapPickerMessage,
    resolveMapPickerStart,
    resolveYandexMapsApiKey,
    yandexMapsLang,
    type LatLon,
    type MapPickerCommand,
    type MapPickerStart,
    type SearchResult,
} from './mapPickerBridge';
import { buildMapPickerHtml } from './mapPickerHtml';

export type MapPick = { lat: number; lon: number; address: string | null };

type Props = {
    visible: boolean;
    /** The form's coordinates (the map opens there with the marker). */
    initialPoint: LatLon | null;
    /** The form's address, shown for the initial point until it is moved. */
    initialAddress?: string | null;
    /** The business city, the start of the map when there is neither a point nor a known position. */
    city?: string | null;
    onClose: () => void;
    onConfirm: (pick: MapPick) => void;
};

/** How long the picker waits for the phone's last known position before opening on the city. */
const LAST_POSITION_WAIT_MS = 1500;

function yandexKey(): string | null {
    // EXPO_PUBLIC_* is inlined at build time only when read literally.
    return resolveYandexMapsApiKey(process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY, Constants.expoConfig?.extra?.yandexMapsApiKey);
}

/** The website's origin: the page runs "on" it, so the key's allowed-referrer rule matches. */
function pageBaseUrl(): string | undefined {
    try {
        return `${getMobileApiUrl()}/`;
    } catch {
        return undefined;
    }
}

async function lastKnownPosition(): Promise<LatLon | null> {
    try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.status !== 'granted') return null;
        const position = await Promise.race([
            Location.getLastKnownPositionAsync(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), LAST_POSITION_WAIT_MS)),
        ]);
        return position ? { lat: position.coords.latitude, lon: position.coords.longitude } : null;
    } catch {
        return null;
    }
}

/**
 * "Выбрать на карте": a full-screen Yandex map (the website's BranchMapPickerYandex, in a WebView):
 * tap or drag the marker, search an address, see the resolved address, confirm.
 */
export default function BranchMapPicker({ visible, ...props }: Props) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            statusBarTranslucent
            onRequestClose={props.onClose}
        >
            {visible ? <MapPickerBody {...props} /> : null}
        </Modal>
    );
}

function IconButton({ icon, label, onPress, busy, testID }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    busy?: boolean;
    testID?: string;
}) {
    return (
        <MotionPressable
            onPress={onPress}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ busy: !!busy }}
            style={styles.iconButton}
            testID={testID}
        >
            {busy ? <ActivityIndicator color={colors.text.primary} /> : <Ionicons name={icon} size={22} color={colors.text.primary} />}
        </MotionPressable>
    );
}

function MapPickerBody({ initialPoint, initialAddress, city, onClose, onConfirm }: Omit<Props, 'visible'>) {
    const { t, locale } = useLanguage();
    const insets = useContext(SafeAreaInsetsContext);
    const network = useNetworkStatus();
    const webViewRef = useRef<React.ElementRef<typeof WebView>>(null);
    const apiKey = useMemo(yandexKey, []);
    const baseUrl = useMemo(pageBaseUrl, []);
    const [state, dispatch] = useReducer(mapPickerReducer, { point: initialPoint, address: initialAddress }, initialMapPickerState);
    const [start, setStart] = useState<MapPickerStart | null>(() => (initialPoint ? resolveMapPickerStart({ point: initialPoint }) : null));
    const [reloadKey, setReloadKey] = useState(0);
    const [query, setQuery] = useState('');
    const [locating, setLocating] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        if (start) return;
        let alive = true;
        void lastKnownPosition().then((userLocation) => {
            if (alive) setStart(resolveMapPickerStart({ point: null, userLocation, city }));
        });
        return () => { alive = false; };
    }, [start, city]);

    const html = useMemo(() => (apiKey && start ? buildMapPickerHtml({
        apiKey,
        lang: yandexMapsLang(locale),
        start,
        background: colors.surface.page,
        accent: colors.accent.indigo,
        dark: true,
    }) : null), [apiKey, start, locale]);

    const send = useCallback((command: MapPickerCommand) => {
        webViewRef.current?.injectJavaScript?.(buildMapPickerCommand(command));
    }, []);

    const stateRef = useRef(state);
    stateRef.current = state;

    const handleMessage = useCallback((event: WebViewMessageEvent) => {
        const message = parseMapPickerMessage(event.nativeEvent.data);
        if (!message) return;
        if (message.type === 'resolving' || message.type === 'pick') setNotice(null);
        if (message.type === 'ready') {
            // A reloaded page (retry, back online) gets the point chosen before it, not the start.
            const { point, address, resolving } = stateRef.current;
            const atStart = start?.marker && point && point.lat === start.center.lat && point.lon === start.center.lon;
            if (point && !atStart) {
                send({ type: 'setPoint', lat: point.lat, lon: point.lon, address: resolving ? null : address, source: 'initial' });
            }
        }
        dispatch(message);
    }, [send, start]);

    const reload = useCallback(() => {
        dispatch({ type: 'reload' });
        setReloadKey((key) => key + 1);
    }, []);

    const submitSearch = () => {
        const text = query.trim();
        if (!text) return;
        Keyboard.dismiss();
        dispatch({ type: 'searchStart', query: text });
        send({ type: 'search', query: text });
    };

    const clearSearch = () => {
        setQuery('');
        dispatch({ type: 'searchClear' });
    };

    const chooseResult = (result: SearchResult) => {
        Keyboard.dismiss();
        setQuery('');
        setNotice(null);
        dispatch({ type: 'chooseResult', result });
        send({ type: 'setPoint', lat: result.lat, lon: result.lon, address: result.address ?? result.title, source: 'search' });
    };

    const locate = async () => {
        setLocating(true);
        setNotice(null);
        try {
            const permission = await Location.requestForegroundPermissionsAsync();
            if (permission.status !== 'granted') {
                setNotice(t('catalog.app.locationDenied'));
                return;
            }
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            send({ type: 'setPoint', lat: position.coords.latitude, lon: position.coords.longitude, source: 'locate' });
        } catch {
            setNotice(t('catalog.app.locationFailed'));
        } finally {
            setLocating(false);
        }
    };

    const result = mapPickerResult(state);
    const top = (insets?.top ?? 0) + space.sm;
    const bottom = (insets?.bottom ?? 0) + space.md;

    let blocker: React.ReactNode = null;
    if (!apiKey) {
        blocker = (
            <EmptyState
                icon="map-outline"
                title={t('catalog.app.mapPicker.noKeyTitle')}
                message={t('catalog.app.mapPicker.noKeyMessage')}
                action={<Button title={t('catalog.app.mapPicker.backToForm')} onPress={onClose} variant="outline" fullWidth testID="map-picker-back" />}
            />
        );
    } else if (network.isOffline) {
        blocker = (
            <ErrorState
                title={t('catalog.app.mapPicker.offlineTitle')}
                message={t('catalog.app.mapPicker.offlineMessage')}
                retryLabel={t('catalog.app.mapPicker.retry')}
                onRetry={reload}
                testID="map-picker-offline"
            />
        );
    } else if (state.status === 'error') {
        blocker = (
            <ErrorState
                title={t('catalog.app.mapPicker.errorTitle')}
                message={t('catalog.app.mapPicker.errorMessage')}
                retryLabel={t('catalog.app.mapPicker.retry')}
                onRetry={reload}
                testID="map-picker-error"
            />
        );
    }

    const ready = !blocker && state.status === 'ready';
    const search = state.search;

    return (
        <View style={styles.container} testID="branch-map-picker">
            <View style={styles.mapArea}>
                {blocker ? (
                    <View style={[styles.blocker, { paddingTop: top + MIN_TOUCH_TARGET + space.lg }]}>{blocker}</View>
                ) : (
                    <>
                        {html ? (
                            <WebView
                                key={reloadKey}
                                ref={webViewRef}
                                source={{ html, baseUrl }}
                                originWhitelist={['*']}
                                onMessage={handleMessage}
                                onError={() => dispatch({ type: 'error', reason: 'script' })}
                                onShouldStartLoadWithRequest={(request) => {
                                    // The page itself and the API's frames load; a tapped link (terms, logo) opens outside.
                                    if (request.isTopFrame === false || !/^https?:/i.test(request.url)) return true;
                                    if (baseUrl && request.url.startsWith(baseUrl)) return true;
                                    void Linking.openURL(request.url);
                                    return false;
                                }}
                                javaScriptEnabled
                                domStorageEnabled
                                setSupportMultipleWindows={false}
                                overScrollMode="never"
                                bounces={false}
                                style={styles.webView}
                                testID="branch-map-picker-webview"
                            />
                        ) : null}
                        {state.status === 'loading' ? (
                            <View style={styles.loadingOverlay} pointerEvents="none">
                                <View style={styles.loadingPill} accessibilityRole="progressbar" accessibilityLabel={t('catalog.app.mapPicker.loading')}>
                                    <ActivityIndicator color={colors.tone.accent.fg} />
                                    <Text style={styles.loadingText}>{t('catalog.app.mapPicker.loading')}</Text>
                                </View>
                            </View>
                        ) : null}
                    </>
                )}

                {/* Floating top bar: close, the address search, my location. */}
                <View style={[styles.topBar, { paddingTop: top }]} pointerEvents="box-none">
                    <View style={styles.topRow}>
                        <IconButton icon="close" label={t('catalog.app.mapPicker.close')} onPress={onClose} testID="map-picker-close" />
                        {ready ? (
                            <Input
                                value={query}
                                onChangeText={setQuery}
                                onSubmitEditing={submitSearch}
                                placeholder={t('catalog.app.mapPicker.searchPlaceholder')}
                                returnKeyType="search"
                                autoCorrect={false}
                                containerStyle={styles.searchContainer}
                                inputContainerStyle={styles.searchField}
                                leadingIcon={<Ionicons name="search" size={18} color={colors.text.secondary} />}
                                trailingIcon={query ? (
                                    <MotionPressable
                                        onPress={clearSearch}
                                        accessibilityRole="button"
                                        accessibilityLabel={t('catalog.app.mapPicker.searchClear')}
                                        hitSlop={space.md}
                                        style={styles.clear}
                                    >
                                        <Ionicons name="close-circle" size={18} color={colors.text.tertiary} />
                                    </MotionPressable>
                                ) : undefined}
                                testID="map-picker-search"
                            />
                        ) : <View style={styles.searchContainer} />}
                        {ready ? (
                            <IconButton
                                icon="locate"
                                label={t('catalog.app.mapPicker.locate')}
                                onPress={() => void locate()}
                                busy={locating}
                                testID="map-picker-locate"
                            />
                        ) : null}
                    </View>

                    {ready && search.status !== 'idle' ? (
                        <View style={styles.results} testID="map-picker-results">
                            {search.status === 'searching' ? (
                                <View style={styles.resultsState}>
                                    <ActivityIndicator color={colors.tone.accent.fg} />
                                    <Text style={styles.resultsStateText}>{t('catalog.app.mapPicker.searching')}</Text>
                                </View>
                            ) : search.status === 'error' || search.results.length === 0 ? (
                                <View style={styles.resultsState}>
                                    <Ionicons
                                        name={search.status === 'error' ? 'alert-circle-outline' : 'search-outline'}
                                        size={18}
                                        color={search.status === 'error' ? colors.tone.danger.fg : colors.text.secondary}
                                    />
                                    <Text style={styles.resultsStateText}>
                                        {search.status === 'error' ? t('catalog.app.mapPicker.searchError') : t('catalog.app.mapPicker.nothingFound')}
                                    </Text>
                                </View>
                            ) : (
                                <ScrollView keyboardShouldPersistTaps="handled" style={styles.resultsList}>
                                    {search.results.map((item, index) => (
                                        <MotionPressable
                                            key={`${item.lat},${item.lon},${index}`}
                                            onPress={() => chooseResult(item)}
                                            accessibilityRole="button"
                                            accessibilityLabel={[item.title, item.subtitle].filter(Boolean).join(', ')}
                                            style={[styles.resultRow, index > 0 && styles.resultSeparator]}
                                            testID={`map-picker-result-${index}`}
                                        >
                                            <View style={styles.resultIcon}>
                                                <Ionicons name="location-outline" size={18} color={colors.tone.accent.fg} />
                                            </View>
                                            <View style={styles.resultText}>
                                                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                                                {item.subtitle ? <Text style={styles.resultSubtitle} numberOfLines={1}>{item.subtitle}</Text> : null}
                                            </View>
                                        </MotionPressable>
                                    ))}
                                </ScrollView>
                            )}
                        </View>
                    ) : null}
                </View>
            </View>

            {/* The chosen place and the one primary action. */}
            {!blocker ? (
                <View style={[styles.sheet, { paddingBottom: bottom }]} testID="map-picker-sheet">
                    <View style={styles.placeRow}>
                        <View style={styles.placeIcon}>
                            <Ionicons name="location" size={22} color={colors.tone.accent.fg} />
                        </View>
                        <View style={styles.placeText}>
                            <Text style={styles.overline}>{t('catalog.app.mapPicker.addressLabel')}</Text>
                            {!state.point ? (
                                <Text style={styles.placeMuted}>{t('catalog.app.mapPicker.hint')}</Text>
                            ) : state.resolving ? (
                                <View style={styles.resolving}>
                                    <ActivityIndicator size="small" color={colors.text.secondary} />
                                    <Text style={styles.placeMuted}>{t('catalog.app.mapPicker.resolving')}</Text>
                                </View>
                            ) : state.address ? (
                                <Text style={styles.placeAddress} numberOfLines={3} testID="map-picker-address">{state.address}</Text>
                            ) : (
                                <Text style={styles.placeMuted}>
                                    {state.geocodeFailed ? t('catalog.app.mapPicker.geocodeFailed') : t('catalog.app.mapPicker.noAddress')}
                                </Text>
                            )}
                            {state.point ? (
                                <Text style={styles.coords} testID="map-picker-coords">
                                    {`${state.point.lat.toFixed(6)}, ${state.point.lon.toFixed(6)}`}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                    {notice ? <FeedbackBanner variant="warning" message={notice} compact style={styles.notice} /> : null}
                    <Button
                        title={t('catalog.app.mapPicker.confirm')}
                        onPress={() => { if (result) onConfirm(result); }}
                        disabled={!result}
                        size="lg"
                        fullWidth
                        testID="map-picker-confirm"
                    />
                    <Text style={styles.provider}>{t('catalog.app.mapPicker.provider')}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface.page },
    mapArea: { flex: 1 },
    webView: { flex: 1, backgroundColor: colors.surface.page },
    blocker: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.gutter },
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
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: layout.gutter },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    iconButton: {
        width: MIN_TOUCH_TARGET + space.xs,
        height: MIN_TOUCH_TARGET + space.xs,
        borderRadius: radii.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surface.card,
        ...elevation.floating,
    },
    searchContainer: { flex: 1, marginBottom: 0 },
    searchField: {
        minHeight: MIN_TOUCH_TARGET + space.xs,
        borderRadius: radii.pill,
        backgroundColor: colors.surface.card,
        ...elevation.floating,
    },
    clear: { minWidth: MIN_TOUCH_TARGET, minHeight: MIN_TOUCH_TARGET, alignItems: 'center', justifyContent: 'center' },
    results: {
        marginTop: space.sm,
        borderRadius: radii.lg,
        backgroundColor: colors.surface.card,
        overflow: 'hidden',
        ...elevation.floating,
    },
    resultsList: { maxHeight: 320 },
    resultsState: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
    resultsStateText: { ...typeScale.callout, color: colors.text.secondary, flex: 1 },
    resultRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        minHeight: MIN_TOUCH_TARGET + space.md,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
    },
    resultSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border.subtle },
    resultIcon: {
        width: 32,
        height: 32,
        borderRadius: radii.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    resultText: { flex: 1 },
    resultTitle: { ...typeScale.bodyStrong, color: colors.text.primary },
    resultSubtitle: { ...typeScale.caption, color: colors.text.secondary },
    sheet: {
        paddingTop: space.lg,
        paddingHorizontal: layout.gutter,
        gap: space.md,
        backgroundColor: colors.surface.card,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border.subtle,
    },
    placeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
    placeIcon: {
        width: MIN_TOUCH_TARGET,
        height: MIN_TOUCH_TARGET,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.tone.accent.bg,
    },
    placeText: { flex: 1, gap: space.xxs, minHeight: MIN_TOUCH_TARGET },
    overline: { ...typeScale.overline, color: colors.text.tertiary },
    placeAddress: { ...typeScale.bodyStrong, color: colors.text.primary },
    placeMuted: { ...typeScale.body, color: colors.text.secondary },
    resolving: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
    coords: { ...typeScale.caption, color: colors.text.tertiary, fontVariant: ['tabular-nums'] },
    notice: { marginBottom: 0 },
    provider: { ...typeScale.caption, color: colors.text.tertiary, textAlign: 'center' },
});
