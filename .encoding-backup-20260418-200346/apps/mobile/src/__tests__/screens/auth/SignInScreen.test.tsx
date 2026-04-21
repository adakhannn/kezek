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
    return {
        NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
        }),
    };
});

describe('SignInScreen', () => {
    test('должен отрендериться без ошибок', () => {
        render(<SignInScreen />);

        expect(screen.getByText('???? ? Kezek')).toBeTruthy();
    });

    test('должен отображать поле ввода email', () => {
        render(<SignInScreen />);

        const emailInput = screen.queryByPlaceholderText('example@mail.com');
        expect(emailInput).toBeTruthy();
    });

    test('должен отображать кнопку входа', () => {
        render(<SignInScreen />);

        const signInButton = screen.queryByText('????????? ???');
        expect(signInButton).toBeTruthy();
    });
});

