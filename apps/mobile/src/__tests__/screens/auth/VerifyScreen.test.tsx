/**
 * Smoke test: VerifyScreen
 * 
 * Проверяет базовый рендеринг экрана подтверждения
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import VerifyScreen from '../../../screens/auth/VerifyScreen';

// Mock navigation
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
        useRoute: () => ({
            params: {
                email: 'test@example.com',
            },
        }),
    };
});

describe('VerifyScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<VerifyScreen />);
        
        // Проверяем наличие основных элементов
        expect(screen.getByText(/подтверждение|verify|код/i)).toBeTruthy();
    });

    test('должен отображать поле ввода кода', () => {
        render(<VerifyScreen />);
        
        // Ищем поле ввода кода
        const codeInput = screen.queryByPlaceholderText(/код|code|otp/i);
        expect(codeInput).toBeTruthy();
    });

    test('должен отображать кнопку подтверждения', () => {
        render(<VerifyScreen />);
        
        // Ищем кнопку подтверждения
        const verifyButton = screen.queryByText(/подтвердить|verify|отправить/i);
        expect(verifyButton).toBeTruthy();
    });
});

