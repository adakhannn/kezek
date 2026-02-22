/**
 * Smoke test: WhatsAppScreen
 * 
 * Проверяет базовый рендеринг экрана WhatsApp авторизации
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import WhatsAppScreen from '../../../screens/auth/WhatsAppScreen';

// Mock navigation
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

describe('WhatsAppScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<WhatsAppScreen />);
        
        // Проверяем наличие основных элементов
        expect(screen.getByText(/whatsapp|вацап/i)).toBeTruthy();
    });

    test('должен отображать поле ввода телефона на первом шаге', () => {
        render(<WhatsAppScreen />);
        
        // Ищем поле ввода телефона
        const phoneInput = screen.queryByPlaceholderText(/телефон|phone/i);
        expect(phoneInput).toBeTruthy();
    });

    test('должен отображать кнопку отправки OTP', () => {
        render(<WhatsAppScreen />);
        
        // Ищем кнопку отправки
        const sendButton = screen.queryByText(/отправить|send|получить код/i);
        expect(sendButton).toBeTruthy();
    });
});

