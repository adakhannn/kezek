import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { apiRequest } from '../../lib/api';
import { MAP_PICKER_SOURCE } from '../../screens/manage/catalog/mapPicker/mapPickerBridge';
import BranchEditScreen from '../../screens/manage/catalog/BranchEditScreen';
import { createTestQueryClient } from '../testQueryClient';

jest.mock('../../lib/api', () => ({ apiRequest: jest.fn() }));
jest.mock('../../screens/manage/currentBusiness', () => ({ ensureCurrentBusiness: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../../contexts/ConfirmContext', () => ({ useConfirm: () => ({ confirm: jest.fn() }) }));
jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: jest.fn() }) }));

const mockInject = jest.fn();
jest.mock('react-native-webview', () => {
    const React = require('react');
    const { View } = require('react-native');
    const WebView = React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
        React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject, reload: jest.fn(), stopLoading: jest.fn() }));
        return React.createElement(View, props);
    });
    return { WebView };
});

const api = apiRequest as jest.MockedFunction<typeof apiRequest>;
const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const props = { navigation, route: { key: 'k', name: 'ManageBranchEdit', params: { bizId: 'biz-1', bizName: 'Low Fade', tz: 'Asia/Bishkek', branchId: 'b1' } } } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

const detail = {
    branch: {
        id: 'b1', name: 'Центр', address: 'Старый адрес', is_active: true, lat: 42.8746, lon: 74.5698, rating_score: null,
        inherit_business_contacts: true, contact_phone: null, contact_whatsapp: null, contact_email: null, website_url: null,
    },
    schedule: [],
    ratingWeights: null,
    isSuperAdmin: false,
    bizSlug: 'low-fade',
    bizName: 'Low Fade',
    businessContacts: { contact_phone: null, contact_whatsapp: null, contact_email: null, website_url: null },
};

const post = (body: Record<string, unknown>) => ({ nativeEvent: { data: JSON.stringify({ source: MAP_PICKER_SOURCE, ...body }) } });

function renderScreen() {
    return render(<QueryClientProvider client={createTestQueryClient()}><BranchEditScreen {...props} /></QueryClientProvider>);
}

const ORIGINAL_KEY = process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY = 'test-key';
    api.mockImplementation(async (endpoint: string) => (endpoint === '/dashboard/branches/b1'
        ? { ok: true, data: detail }
        : { ok: true }));
});

afterAll(() => {
    process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY = ORIGINAL_KEY;
});

describe('BranchEditScreen: "Выбрать на карте"', () => {
    test('opens on the branch point; a tap resolves the address; confirm fills the form', async () => {
        renderScreen();
        // The first render of the suite loads the whole screen module graph: give it time.
        fireEvent.press(await screen.findByTestId('branch-pick-on-map', {}, { timeout: 10000 }));

        const webView = screen.getByTestId('branch-map-picker-webview');
        expect(webView.props.source.html).toContain('"apiKey":"test-key"');
        expect(webView.props.source.html).toContain('"marker":true');
        expect(webView.props.source.baseUrl).toBe('https://kezek.vercel.app/');
        // The branch's own address and point are shown until the marker moves.
        expect(screen.getByTestId('map-picker-address').props.children).toBe('Старый адрес');
        expect(screen.getByText('Загружаем карту…')).toBeTruthy();

        act(() => { webView.props.onMessage(post({ type: 'ready' })); });
        expect(screen.queryByText('Загружаем карту…')).toBeNull();

        act(() => { webView.props.onMessage(post({ type: 'resolving', lat: 42.88, lon: 74.61, from: 'tap' })); });
        expect(screen.getByText('Определяем адрес…')).toBeTruthy();
        fireEvent.press(screen.getByTestId('map-picker-confirm'));
        expect(screen.getByTestId('branch-map-picker')).toBeTruthy(); // still resolving: nothing to confirm

        act(() => {
            webView.props.onMessage(post({ type: 'pick', lat: 42.880001, lon: 74.610002, address: 'Кыргызстан, Бишкек, проспект Чуй, 120', geocodeFailed: false, from: 'tap' }));
        });
        expect(screen.getByTestId('map-picker-coords').props.children).toBe('42.880001, 74.610002');
        fireEvent.press(screen.getByTestId('map-picker-confirm'));

        await waitFor(() => expect(screen.queryByTestId('branch-map-picker')).toBeNull());
        expect(screen.getByTestId('branch-lat').props.value).toBe('42.880001');
        expect(screen.getByTestId('branch-lon').props.value).toBe('74.610002');
        expect(screen.getByTestId('branch-address').props.value).toBe('Кыргызстан, Бишкек, проспект Чуй, 120');

        // The new point and address are saved with the form.
        fireEvent.press(screen.getByTestId('branch-save'));
        await waitFor(() => expect(api).toHaveBeenCalledWith('/branches/b1/update', expect.objectContaining({ method: 'POST' })));
        const body = JSON.parse(String(api.mock.calls.find(([endpoint]) => endpoint === '/branches/b1/update')![1]!.body));
        expect(body).toMatchObject({ lat: 42.880001, lon: 74.610002, address: 'Кыргызстан, Бишкек, проспект Чуй, 120' });
    });

    test('search sends the query to the map and a chosen result is placed', async () => {
        renderScreen();
        fireEvent.press(await screen.findByTestId('branch-pick-on-map'));
        const webView = screen.getByTestId('branch-map-picker-webview');
        act(() => { webView.props.onMessage(post({ type: 'ready' })); });

        fireEvent.changeText(screen.getByTestId('map-picker-search'), 'Чуй 120');
        fireEvent(screen.getByTestId('map-picker-search'), 'submitEditing');
        expect(screen.getByText('Ищем…')).toBeTruthy();
        expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('\\"query\\":\\"Чуй 120\\"'));

        act(() => {
            webView.props.onMessage(post({
                type: 'searchResults',
                query: 'Чуй 120',
                results: [{ lat: 42.87, lon: 74.61, title: 'проспект Чуй, 120', subtitle: 'Бишкек', address: 'Кыргызстан, Бишкек, проспект Чуй, 120' }],
            }));
        });
        fireEvent.press(screen.getByTestId('map-picker-result-0'));
        expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('\\"type\\":\\"setPoint\\"'));
        expect(screen.queryByTestId('map-picker-results')).toBeNull();
        expect(screen.getByTestId('map-picker-address').props.children).toBe('Кыргызстан, Бишкек, проспект Чуй, 120');
    });

    test('my location asks the phone and moves the marker there', async () => {
        renderScreen();
        fireEvent.press(await screen.findByTestId('branch-pick-on-map'));
        act(() => { screen.getByTestId('branch-map-picker-webview').props.onMessage(post({ type: 'ready' })); });
        fireEvent.press(screen.getByTestId('map-picker-locate'));
        await waitFor(() => expect(mockInject).toHaveBeenLastCalledWith(expect.stringContaining('\\"source\\":\\"locate\\"')));
        expect(Location.getCurrentPositionAsync).toHaveBeenCalled();
    });

    test('a map that failed to load shows ErrorState with retry; closing keeps the form', async () => {
        renderScreen();
        fireEvent.press(await screen.findByTestId('branch-pick-on-map'));
        act(() => { screen.getByTestId('branch-map-picker-webview').props.onMessage(post({ type: 'error', reason: 'timeout' })); });
        expect(screen.getByText('Не удалось загрузить карту')).toBeTruthy();
        expect(screen.queryByTestId('branch-map-picker-webview')).toBeNull();
        fireEvent.press(screen.getByTestId('map-picker-error-retry'));
        expect(screen.getByTestId('branch-map-picker-webview')).toBeTruthy();

        fireEvent.press(screen.getByTestId('map-picker-close'));
        await waitFor(() => expect(screen.queryByTestId('branch-map-picker')).toBeNull());
        expect(screen.getByTestId('branch-lat').props.value).toBe('42.8746');
        expect(screen.getByTestId('branch-address').props.value).toBe('Старый адрес');
    });

    test('a build without the key uses the public map key of the website', async () => {
        process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY = '';
        const base = api.getMockImplementation();
        api.mockImplementation(async (endpoint: string, ...rest) =>
            endpoint === '/public/maps-config' ? ({ ok: true, data: { yandexMapsApiKey: 'web-key' } } as never) : base!(endpoint, ...rest));
        renderScreen();
        fireEvent.press(await screen.findByTestId('branch-pick-on-map'));
        expect(await screen.findByTestId('branch-map-picker-webview')).toBeTruthy();
        expect(api).toHaveBeenCalledWith('/public/maps-config');
    });

    test('a build without the Yandex key says so and offers the manual fields', async () => {
        process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY = '';
        // Neither the build nor the website (GET /public/maps-config) has a key.
        const base = api.getMockImplementation();
        api.mockImplementation(async (endpoint: string, ...rest) =>
            endpoint === '/public/maps-config' ? ({ ok: true, data: { yandexMapsApiKey: null } } as never) : base!(endpoint, ...rest));
        renderScreen();
        fireEvent.press(await screen.findByTestId('branch-pick-on-map'));
        expect(await screen.findByText('Карта не настроена')).toBeTruthy();
        expect(screen.queryByTestId('branch-map-picker-webview')).toBeNull();
        fireEvent.press(screen.getByTestId('map-picker-back'));
        await waitFor(() => expect(screen.queryByTestId('branch-map-picker')).toBeNull());
        // The existing fallbacks stay.
        expect(screen.getByText('Определить по геолокации')).toBeTruthy();
        expect(screen.getByTestId('branch-lat')).toBeTruthy();
    });
});
