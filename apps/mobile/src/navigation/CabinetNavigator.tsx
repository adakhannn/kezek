import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useLanguage } from '../i18n';
import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { CabinetStackParamList } from './types';
import {
    cabinetStackScreenOptions,
    createNavigationHeaderTitle,
} from './mainNavigatorConfig';

const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

export function CabinetNavigator() {
    const { t } = useLanguage();

    return (
        <CabinetStack.Navigator screenOptions={cabinetStackScreenOptions}>
            <CabinetStack.Screen
                name="CabinetMain"
                component={CabinetScreen}
                options={{
                    title: t('nav.cabinet'),
                    headerTitle: createNavigationHeaderTitle(t('nav.cabinet')),
                }}
            />
            <CabinetStack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: t('nav.profile'),
                    headerTitle: createNavigationHeaderTitle(t('nav.profile')),
                }}
            />
        </CabinetStack.Navigator>
    );
}
