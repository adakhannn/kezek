import { Ionicons } from '@expo/vector-icons';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Pressable, StyleSheet } from 'react-native';

import { AuthStackParamList, RootStackParamList } from './types';
import { colors } from '../constants/colors';
import { useLanguage } from '../i18n';
import SignInScreen from '../screens/auth/SignInScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';
import WhatsAppScreen from '../screens/auth/WhatsAppScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * The sign-in is optional (C1): closing it returns to the screen that opened it, or to the home
 * screen when the app was opened on the sign-in link itself.
 */
export function AuthCloseButton() {
    const navigation = useNavigation();
    const { t } = useLanguage();
    const close = () => {
        const root = navigation.getParent<NavigationProp<RootStackParamList>>();
        if (root?.canGoBack()) {
            root.goBack();
            return;
        }
        (root ?? (navigation as unknown as NavigationProp<RootStackParamList>)).navigate('Main', { screen: 'Home' });
    };

    return (
        <Pressable
            onPress={close}
            hitSlop={12}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel={t('discovery.signIn.close')}
            testID="auth-close"
        >
            <Ionicons name="close" size={24} color={colors.text.primary} />
        </Pressable>
    );
}

export default function AuthNavigator() {
    const { t } = useLanguage();

    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                },
                headerShadowVisible: false,
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                    color: colors.text.primary,
                },
            }}
        >
            <Stack.Screen
                name="SignIn"
                component={SignInScreen}
                options={{ title: t('nav.signIn'), headerLeft: () => <AuthCloseButton /> }}
            />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: t('nav.verify') }} />
            <Stack.Screen name="WhatsApp" component={WhatsAppScreen} options={{ title: 'WhatsApp' }} />
        </Stack.Navigator>
    );
}

const styles = StyleSheet.create({
    close: {
        minWidth: 44,
        minHeight: 44,
        alignItems: 'flex-start',
        justifyContent: 'center',
    },
});
