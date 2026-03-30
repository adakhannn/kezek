import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { CabinetStackParamList } from './types';
import { cabinetStackScreenOptions } from './mainNavigatorConfig';

const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

export function CabinetNavigator() {
    return (
        <CabinetStack.Navigator screenOptions={cabinetStackScreenOptions}>
            <CabinetStack.Screen
                name="CabinetMain"
                component={CabinetScreen}
                options={{ title: 'Личный кабинет' }}
            />
            <CabinetStack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ title: 'Профиль' }}
            />
        </CabinetStack.Navigator>
    );
}
