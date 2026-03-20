import React from 'react';
import { render, screen } from '@testing-library/react-native';

import BookingScreen from '../../screens/BookingScreen';
import { useBookingScreenInit } from '../../screens/booking/useBookingScreenInit';

jest.mock('@react-navigation/native', () => {
    const actualNav = jest.requireActual('@react-navigation/native');
    return {
        ...actualNav,
        useRoute: () => ({
            params: {
                slug: 'salon-one',
            },
        }),
    };
});

jest.mock('../../screens/booking/useBookingScreenInit', () => ({
    useBookingScreenInit: jest.fn(),
}));

jest.mock('../../screens/booking/BookingStep1Branch', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return function MockBookingStep1Branch() {
        return React.createElement(Text, null, 'BookingStep1Branch');
    };
});

const mockUseBookingScreenInit = useBookingScreenInit as jest.MockedFunction<
    typeof useBookingScreenInit
>;

describe('BookingScreen', () => {
    beforeEach(() => {
        mockUseBookingScreenInit.mockReturnValue({
            isLoading: false,
        });
    });

    test('wires route slug into init hook and renders first booking step', () => {
        render(<BookingScreen />);

        expect(mockUseBookingScreenInit).toHaveBeenCalledWith({ slug: 'salon-one' });
        expect(screen.getByText('BookingStep1Branch')).toBeTruthy();
    });
});
