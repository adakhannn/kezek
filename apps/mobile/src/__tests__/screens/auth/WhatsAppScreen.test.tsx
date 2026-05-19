/**
 * Smoke test: WhatsAppScreen
 *
 * Проверяет базовый рендеринг экрана WhatsApp авторизации.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import WhatsAppScreen from '../../../screens/auth/WhatsAppScreen';

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
    test('должен отрендериться без ошибок', () => {
        render(<WhatsAppScreen />);

        expect(screen.getByText('Вход через WhatsApp')).toBeTruthy();
    });

    test('должен отображать поле ввода телефона на первом шаге', () => {
        render(<WhatsAppScreen />);

        const phoneInput = screen.queryByPlaceholderText('+996500574029');
        expect(phoneInput).toBeTruthy();
    });

    test('должен отображать кнопку отправки OTP', () => {
        render(<WhatsAppScreen />);

        const sendButton = screen.queryByText('Отправить код');
        expect(sendButton).toBeTruthy();
    });
});
