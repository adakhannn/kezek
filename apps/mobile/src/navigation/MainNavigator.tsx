import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useUserRole } from '../hooks/useUserRole';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import StaffScreen from '../screens/StaffScreen';
import { CabinetNavigator } from './CabinetNavigator';
import {
    createNavigationHeaderTitle,
    mainTabScreenOptions,
    renderTabIcon,
} from './mainNavigatorConfig';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
    const { isOwner, isStaff } = useUserRole();

    return (
        <Tab.Navigator screenOptions={mainTabScreenOptions}>
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Р“Р»Р°РІРЅР°СЏ',
                    headerTitle: createNavigationHeaderTitle('Р“Р»Р°РІРЅР°СЏ'),
                    tabBarLabel: 'Р“Р»Р°РІРЅР°СЏ',
                    tabBarIcon: renderTabIcon('home'),
                }}
            />
            <Tab.Screen
                name="Cabinet"
                component={CabinetNavigator}
                options={{
                    headerShown: false,
                    tabBarLabel: 'РљР°Р±РёРЅРµС‚',
                    tabBarIcon: renderTabIcon('person'),
                }}
            />
            {isOwner ? (
                <Tab.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{
                        title: 'РњРѕР№ Р±РёР·РЅРµСЃ',
                        headerTitle: createNavigationHeaderTitle('РњРѕР№ Р±РёР·РЅРµСЃ'),
                        tabBarLabel: 'Р‘РёР·РЅРµСЃ',
                        tabBarIcon: renderTabIcon('business'),
                    }}
                />
            ) : null}
            {isStaff ? (
                <Tab.Screen
                    name="Staff"
                    component={StaffScreen}
                    options={{
                        title: 'Р Р°Р±РѕС‡Р°СЏ Р·РѕРЅР°',
                        headerTitle: createNavigationHeaderTitle('Р Р°Р±РѕС‡Р°СЏ Р·РѕРЅР°'),
                        tabBarLabel: 'Р Р°Р±РѕС‚Р°',
                        tabBarIcon: renderTabIcon('briefcase'),
                    }}
                />
            ) : null}
        </Tab.Navigator>
    );
}
