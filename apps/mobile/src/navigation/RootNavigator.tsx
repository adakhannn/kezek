import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useQueryClient } from '@tanstack/react-query';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import { colors } from '../constants/colors';
import { BookingProvider } from '../contexts/BookingContext';
import { useLanguage } from '../i18n';
import { linking } from './linking';
import { NavigationSessionProvider } from './NavigationSessionContext';
import {
    AppStackScreens,
    AuthStackScreen,
    rootStackScreenOptions,
} from './RootNavigatorScreens';
import { RootStackParamList } from './types';
import { useRootNavigationSession } from './useRootNavigationSession';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { loading, hasSession, session } = useRootNavigationSession();
    const { t, ready: languageReady } = useLanguage();
    const queryClient = useQueryClient();
    const userId = session?.user?.id ?? null;
    const previousUserIdRef = useRef(userId);
    const navigationSession = useMemo(() => ({ session, hasSession }), [session, hasSession]);

    // The shared ['user'] query was answered "nobody" while browsing signed out: after a sign-in
    // it is asked again, so the role tabs, the home bookings and the cabinet see the account.
    useEffect(() => {
        if (previousUserIdRef.current === userId) return;
        previousUserIdRef.current = userId;
        void queryClient.invalidateQueries({ queryKey: ['user'] });
    }, [queryClient, userId]);

    // Waits for the stored language too, so the first screen is not drawn in Russian first.
    if (loading || !languageReady) {
        return (
            <View style={styles.loading}>
                <LoadingSpinner message={t('common.loading')} />
            </View>
        );
    }

    // Browsing, the business page and the booking flow need no account (C1, Apple 5.1.1). The
    // account screens show a sign-in entry; the Auth screen exists only without a session, so a
    // sign-in removes it and returns the user to the screen that opened it.
    return (
        <NavigationSessionProvider value={navigationSession}>
            <BookingProvider ownerId={userId}>
                <NavigationContainer linking={linking}>
                    <Stack.Navigator screenOptions={rootStackScreenOptions}>
                        {AppStackScreens(Stack, t)}
                        {hasSession ? null : AuthStackScreen(Stack)}
                    </Stack.Navigator>
                </NavigationContainer>
            </BookingProvider>
        </NavigationSessionProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: colors.background.primary,
    },
});
