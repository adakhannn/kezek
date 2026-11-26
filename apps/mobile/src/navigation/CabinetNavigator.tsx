import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useLanguage } from '../i18n';
import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { CabinetStackParamList } from './types';
import {
    cabinetStackScreenOptions,
    createNavigationHeaderTitle,
} from './mainNavigatorConfig';
import { withSessionGate } from './SessionGate';

const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

// The Cabinet tab is there signed out too: it shows the sign-in entry instead of the account (C1).
const GuardedCabinetScreen = withSessionGate(CabinetScreen, 'cabinet');
const GuardedProfileScreen = withSessionGate(ProfileScreen, 'profile');

export function CabinetNavigator() {
    const { t } = useLanguage();

    return (
        <CabinetStack.Navigator screenOptions={cabinetStackScreenOptions}>
            <CabinetStack.Screen
                name="CabinetMain"
                component={GuardedCabinetScreen}
                options={{
                    title: t('nav.cabinet'),
                    headerTitle: createNavigationHeaderTitle(t('nav.cabinet')),
                }}
            />
            <CabinetStack.Screen
                name="Profile"
                component={GuardedProfileScreen}
                options={{
                    title: t('nav.profile'),
                    headerTitle: createNavigationHeaderTitle(t('nav.profile')),
                }}
            />
        </CabinetStack.Navigator>
    );
}
