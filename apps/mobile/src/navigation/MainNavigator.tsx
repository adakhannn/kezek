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
import { useNavigationSession } from './NavigationSessionContext';
import { withSessionGate } from './SessionGate';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const GuardedDashboardScreen = withSessionGate(DashboardScreen, 'workspace');
const GuardedStaffScreen = withSessionGate(StaffScreen, 'workspace');

export default function MainNavigator() {
    const { isOwner, isStaff } = useUserRole();
    const { hasSession } = useNavigationSession();
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
            {hasSession && isOwner ? (
                <Tab.Screen
                    name="Dashboard"
                    component={GuardedDashboardScreen}
                    options={{
                        title: t('nav.business'),
                        headerTitle: createNavigationHeaderTitle(t('nav.business')),
                        tabBarLabel: t('nav.businessTab'),
                        tabBarAccessibilityLabel: t('nav.businessTab'),
                        tabBarIcon: renderTabIcon('business'),
                    }}
                />
            ) : null}
            {hasSession && isStaff ? (
                <Tab.Screen
                    name="Staff"
                    component={GuardedStaffScreen}
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
