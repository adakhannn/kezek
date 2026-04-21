import { createNativeStackNavigator } from '@react-navigation/native-stack';

import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import type { CabinetStackParamList } from './types';
import {
    cabinetStackScreenOptions,
    createNavigationHeaderTitle,
} from './mainNavigatorConfig';

const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

export function CabinetNavigator() {
    return (
        <CabinetStack.Navigator screenOptions={cabinetStackScreenOptions}>
            <CabinetStack.Screen
                name="CabinetMain"
                component={CabinetScreen}
                options={{
                    title: 'Личный кабинет',
                    headerTitle: createNavigationHeaderTitle('Личный кабинет'),
                }}
            />
            <CabinetStack.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    title: 'Профиль',
                    headerTitle: createNavigationHeaderTitle('Профиль'),
                }}
            />
        </CabinetStack.Navigator>
    );
}
