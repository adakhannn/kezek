import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AuthStackParamList } from '../../../navigation/types';
import { WHATSAPP_MOBILE_AUTH_ENABLED } from './authFeatureFlags';

type SignInScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>;

export function useWhatsAppSignInFlow() {
    const navigation = useNavigation<SignInScreenNavigationProp>();

    const openWhatsAppSignIn = () => {
        navigation.navigate('WhatsApp');
    };

    return {
        whatsAppMobileAuthEnabled: WHATSAPP_MOBILE_AUTH_ENABLED,
        openWhatsAppSignIn,
    };
}

