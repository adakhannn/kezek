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
    return {
        NavigationContainer: ({ children }: { children: React.ReactNode }) => children,
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

        expect(screen.getByText('?????????????')).toBeTruthy();
    });

    test('должен отображать поле ввода кода', () => {
        render(<VerifyScreen />);

        const codeInput = screen.queryByPlaceholderText('000000');
        expect(codeInput).toBeTruthy();
    });

    test('должен отображать кнопку подтверждения', () => {
        render(<VerifyScreen />);

        const verifyButton = screen.queryByText('???????????');
        expect(verifyButton).toBeTruthy();
    });
});

