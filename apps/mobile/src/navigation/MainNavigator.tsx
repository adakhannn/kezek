import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useUserRole } from '../hooks/useUserRole';
import { useLanguage } from '../i18n';
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
    const { t } = useLanguage();

    return (
        <Tab.Navigator backBehavior="history" screenOptions={mainTabScreenOptions}>
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: t('nav.home'),
                    headerTitle: createNavigationHeaderTitle(t('nav.home')),
                    tabBarLabel: t('nav.home'),
                    tabBarAccessibilityLabel: t('nav.homeTabA11y'),
                    tabBarIcon: renderTabIcon('home'),
                }}
            />
            <Tab.Screen
                name="Cabinet"
                component={CabinetNavigator}
                options={{
                    headerShown: false,
                    tabBarLabel: t('nav.cabinetTab'),
                    tabBarAccessibilityLabel: t('nav.cabinetTab'),
                    tabBarIcon: renderTabIcon('person'),
                }}
            />
            {isOwner ? (
                <Tab.Screen
                    name="Dashboard"
                    component={DashboardScreen}
                    options={{
                        title: t('nav.business'),
                        headerTitle: createNavigationHeaderTitle(t('nav.business')),
                        tabBarLabel: t('nav.businessTab'),
                        tabBarAccessibilityLabel: t('nav.businessTab'),
                        tabBarIcon: renderTabIcon('business'),
                    }}
                />
            ) : null}
            {isStaff ? (
                <Tab.Screen
                    name="Staff"
                    component={StaffScreen}
                    options={{
                        title: t('nav.staff'),
                        headerTitle: createNavigationHeaderTitle(t('nav.staff')),
                        tabBarLabel: t('nav.staffTab'),
                        tabBarAccessibilityLabel: t('nav.staffTab'),
                        tabBarIcon: renderTabIcon('briefcase'),
                    }}
                />
            ) : null}
        </Tab.Navigator>
    );
}
