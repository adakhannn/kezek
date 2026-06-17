/**
 * Smoke test: WhatsAppScreen
 *
 * Проверяет базовый рендеринг экрана WhatsApp авторизации.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';

import WhatsAppScreen from '../../../screens/auth/WhatsAppScreen';
import * as fetchWithTimeoutModule from '../../../lib/fetchWithTimeout';

jest.mock('@react-navigation/native', () => {
    return {
        NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

describe('WhatsAppScreen', () => {
    beforeEach(() => {
        (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
        (SecureStore.setItemAsync as jest.Mock).mockResolvedValue(undefined);
        (SecureStore.deleteItemAsync as jest.Mock).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        (SecureStore.getItemAsync as jest.Mock).mockReset();
        (SecureStore.setItemAsync as jest.Mock).mockReset();
        (SecureStore.deleteItemAsync as jest.Mock).mockReset();
    });

    test('должен отрендериться без ошибок', () => {
        render(<WhatsAppScreen />);

        expect(screen.getByText('Вход через WhatsApp')).toBeTruthy();
    });

    test('должен отображать поле ввода телефона на первом шаге', () => {
        render(<WhatsAppScreen />);

        const phoneInput = screen.queryByPlaceholderText('+996 XXX XX XX XX');
        expect(phoneInput).toBeTruthy();
    });

    test('должен отображать кнопку отправки OTP', () => {
        render(<WhatsAppScreen />);

        const sendButton = screen.queryByText('Отправить код');
        expect(sendButton).toBeTruthy();
    });

    test('shows phone validation once to avoid duplicate screen-reader announcements', () => {
        render(<WhatsAppScreen />);

        fireEvent.press(screen.getByText('Отправить код'));

        expect(screen.getAllByText('Телефон обязателен')).toHaveLength(1);
    });

    test('OTP field has an explicit screen-reader label', async () => {
        jest.spyOn(fetchWithTimeoutModule, 'fetchWithTimeout').mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                ok: true,
                data: {
                    attemptId: 'attempt-a11y',
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
                },
            }),
        } as Response);

        render(<WhatsAppScreen />);

        fireEvent.changeText(screen.getByPlaceholderText('+996 XXX XX XX XX'), '+996555000111');
        fireEvent.press(screen.getByText('Отправить код'));

        expect(await screen.findByLabelText('Код из WhatsApp')).toBeTruthy();
    });

    test('reuses the same idempotency key when a send request is retried', async () => {
        const fetchSpy = jest
            .spyOn(fetchWithTimeoutModule, 'fetchWithTimeout')
            .mockRejectedValueOnce(new TypeError('Network request failed'))
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    ok: true,
                    data: {
                        attemptId: 'attempt-1',
                        expiresAt: '2026-06-09T12:30:00.000Z',
                    },
                }),
            } as Response);

        render(<WhatsAppScreen />);

        fireEvent.changeText(screen.getByPlaceholderText('+996 XXX XX XX XX'), '+996555000111');
        fireEvent.press(screen.getByText('Отправить код'));

        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.getByText('Отправить код')).toBeTruthy());
        fireEvent.press(screen.getByText('Отправить код'));

        await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));

        const firstHeaders = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
        const retryHeaders = fetchSpy.mock.calls[1][1]?.headers as Record<string, string>;
        expect(retryHeaders['x-idempotency-key']).toBe(firstHeaders['x-idempotency-key']);
    });
});
