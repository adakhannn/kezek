/**
 * Smoke test: SignInScreen
 * 
 * Проверяет базовый рендеринг экрана входа
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SignInScreen from '../../../screens/auth/SignInScreen';

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

describe('SignInScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<SignInScreen />);
        
        // Проверяем наличие основных элементов
        expect(screen.getByText(/вход|sign in/i)).toBeTruthy();
    });

    test('должен отображать поле ввода email', () => {
        render(<SignInScreen />);
        
        // Ищем поле ввода email
        const emailInput = screen.queryByPlaceholderText(/email|почта/i);
        expect(emailInput).toBeTruthy();
    });

    test('должен отображать кнопку входа', () => {
        render(<SignInScreen />);
        
        // Ищем кнопку входа
        const signInButton = screen.queryByText(/войти|sign in|отправить/i);
        expect(signInButton).toBeTruthy();
    });
});

