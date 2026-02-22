/**
 * Smoke test: Navigation between booking steps
 * 
 * Проверяет базовую навигацию между шагами бронирования
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BookingStep1Branch from '../../screens/booking/BookingStep1Branch';
import BookingStep2Service from '../../screens/booking/BookingStep2Service';
import BookingStep3Staff from '../../screens/booking/BookingStep3Staff';
import BookingStep4Date from '../../screens/booking/BookingStep4Date';
import BookingStep5Time from '../../screens/booking/BookingStep5Time';
import BookingStep6Confirm from '../../screens/booking/BookingStep6Confirm';
import { BookingProvider } from '../../contexts/BookingContext';

const Stack = createNativeStackNavigator();

// Mock useRoute для каждого шага
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            setOptions: jest.fn(),
        }),
    };
});

// Mock useRoute для каждого шага отдельно
jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            setOptions: jest.fn(),
        }),
        useRoute: jest.fn(() => ({
            params: {
                slug: 'test-business-slug',
            },
        })),
    };
});

describe('Booking Navigation', () => {
    const renderWithNavigation = (component: React.ReactElement) => {
        return render(
            <NavigationContainer>
                <BookingProvider>
                    <Stack.Navigator>
                        <Stack.Screen name="Test" component={() => component} />
                    </Stack.Navigator>
                </BookingProvider>
            </NavigationContainer>
        );
    };

    test('BookingStep1Branch должен отрендериться', () => {
        renderWithNavigation(<BookingStep1Branch />);
        // Проверяем, что экран рендерится (может быть заголовок или основной контент)
        const element = screen.queryByTestId('booking-step-1') || 
                       screen.queryByText(/филиал|branch|выбор/i);
        expect(element).toBeTruthy();
    });

    test('BookingStep2Service должен отрендериться', () => {
        renderWithNavigation(<BookingStep2Service />);
        const element = screen.queryByTestId('booking-step-2') || 
                       screen.queryByText(/услуга|service|выбор/i);
        expect(element).toBeTruthy();
    });

    test('BookingStep3Staff должен отрендериться', () => {
        renderWithNavigation(<BookingStep3Staff />);
        const element = screen.queryByTestId('booking-step-3') || 
                       screen.queryByText(/мастер|staff|выбор/i);
        expect(element).toBeTruthy();
    });

    test('BookingStep4Date должен отрендериться', () => {
        renderWithNavigation(<BookingStep4Date />);
        const element = screen.queryByTestId('booking-step-4') || 
                       screen.queryByText(/дата|date|выбор/i);
        expect(element).toBeTruthy();
    });

    test('BookingStep5Time должен отрендериться', () => {
        renderWithNavigation(<BookingStep5Time />);
        const element = screen.queryByTestId('booking-step-5') || 
                       screen.queryByText(/время|time|выбор/i);
        expect(element).toBeTruthy();
    });

    test('BookingStep6Confirm должен отрендериться', () => {
        renderWithNavigation(<BookingStep6Confirm />);
        const element = screen.queryByTestId('booking-step-6') || 
                       screen.queryByText(/подтверждение|confirm|итог/i);
        expect(element).toBeTruthy();
    });
});

