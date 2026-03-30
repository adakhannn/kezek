/**
 * Smoke test: SignUpScreen
 * 
 * Проверяет базовый рендеринг экрана регистрации
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import SignUpScreen from '../../../screens/auth/SignUpScreen';

// Mock navigation
jest.mock('@react-navigation/native', () => {
    return {
        NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

describe('SignUpScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<SignUpScreen />);
        
        // Проверяем наличие основных элементов
        expect(screen.getByText(/регистрация|sign up/i)).toBeTruthy();
    });

    test('должен отображать поле ввода email', () => {
        render(<SignUpScreen />);

        const emailInput = screen.queryByPlaceholderText('example@mail.com');
        expect(emailInput).toBeTruthy();
    });

    test('должен отображать кнопку регистрации', () => {
        render(<SignUpScreen />);
        
        // Ищем кнопку регистрации
        const signUpButton = screen.queryByText(/зарегистрироваться|sign up|отправить/i);
        expect(signUpButton).toBeTruthy();
    });
});

