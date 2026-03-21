import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { colors } from '../constants/colors';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';
import WhatsAppScreen from '../screens/auth/WhatsAppScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.dark,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                    color: colors.text.primary,
                },
            }}
        >
            <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Вход' }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Регистрация' }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: 'Подтверждение' }} />
            <Stack.Screen name="WhatsApp" component={WhatsAppScreen} options={{ title: 'WhatsApp' }} />
        </Stack.Navigator>
    );
}

