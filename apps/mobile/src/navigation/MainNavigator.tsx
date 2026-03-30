import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useUserRole } from '../hooks/useUserRole';
import DashboardScreen from '../screens/DashboardScreen';
import HomeScreen from '../screens/HomeScreen';
import StaffScreen from '../screens/StaffScreen';
import { CabinetNavigator } from './CabinetNavigator';
import { mainTabScreenOptions, renderTabIcon } from './mainNavigatorConfig';
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
                    title: 'Главная',
                    tabBarLabel: 'Главная',
                    tabBarIcon: renderTabIcon('home'),
                }}
            />
            <Tab.Screen
                name="Cabinet"
                component={CabinetNavigator}
                options={{
                    headerShown: false,
                    tabBarLabel: 'Кабинет',
                    tabBarIcon: renderTabIcon('person'),
                }}
            />
            {isOwner && (
                <Tab.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{
                        title: 'Кабинет бизнеса',
                        tabBarLabel: 'Бизнес',
                        tabBarIcon: renderTabIcon('business'),
                    }}
                />
            )}
            {isStaff && (
                <Tab.Screen
                    name="Staff"
                    component={StaffScreen}
                    options={{
                        title: 'Кабинет сотрудника',
                        tabBarLabel: 'Сотрудник',
                        tabBarIcon: renderTabIcon('briefcase'),
                    }}
                />
            )}
        </Tab.Navigator>
    );
}
