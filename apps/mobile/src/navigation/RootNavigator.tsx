import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { colors } from '../constants/colors';
import { BookingProvider } from '../contexts/BookingContext';
import { linking } from './linking';
import {
    AuthStackScreen,
    rootStackScreenOptions,
    SignedInStackScreens,
} from './RootNavigatorScreens';
import { RootStackParamList } from './types';
import { useRootNavigationSession } from './useRootNavigationSession';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { loading, hasSession } = useRootNavigationSession();

    if (loading) {
        return (
            <View style={styles.loading}>
                <ActivityIndicator size="large" color="#6366f1" />
                <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
        );
    }

    return (
        <BookingProvider>
            <NavigationContainer linking={linking}>
                <Stack.Navigator screenOptions={rootStackScreenOptions}>
                    {hasSession ? SignedInStackScreens(Stack) : AuthStackScreen(Stack)}
                </Stack.Navigator>
            </NavigationContainer>
        </BookingProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background.primary,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: '#6b7280',
    },
});
