import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import VerifyScreen from '../screens/auth/VerifyScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
    return (
        <Stack.Navigator>
            <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Вход' }} />
            <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Регистрация' }} />
            <Stack.Screen name="Verify" component={VerifyScreen} options={{ title: 'Подтверждение' }} />
        </Stack.Navigator>
    );
}

