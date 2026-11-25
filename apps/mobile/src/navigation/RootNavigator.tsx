import React from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import { colors } from '../constants/colors';
import { BookingProvider } from '../contexts/BookingContext';
import { useLanguage } from '../i18n';
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
    const { loading, hasSession, session } = useRootNavigationSession();
    const { t, ready: languageReady } = useLanguage();

    // Waits for the stored language too, so the first screen is not drawn in Russian first.
    if (loading || !languageReady) {
        return (
            <View style={styles.loading}>
                <LoadingSpinner message={t('common.loading')} />
            </View>
        );
    }

    return (
        <BookingProvider ownerId={session?.user?.id ?? null}>
            <NavigationContainer linking={linking}>
                <Stack.Navigator screenOptions={rootStackScreenOptions}>
                    {hasSession ? SignedInStackScreens(Stack, t) : AuthStackScreen(Stack)}
                </Stack.Navigator>
            </NavigationContainer>
        </BookingProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
});

