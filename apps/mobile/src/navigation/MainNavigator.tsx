import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MainTabParamList, CabinetStackParamList } from './types';
import { useUserRole } from '../hooks/useUserRole';
import { colors } from '../constants/colors';
import HomeScreen from '../screens/HomeScreen';
import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StaffScreen from '../screens/StaffScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

function CabinetNavigator() {
    return (
        <CabinetStack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.dark,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                    color: colors.text.primary,
                },
            }}
        >
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

export default function MainNavigator() {
    const { isOwner, isStaff, isLoading } = useUserRole();

    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: colors.primary.from, // indigo-600 (из градиента)
                tabBarInactiveTintColor: colors.text.tertiary,
                tabBarStyle: {
                    backgroundColor: colors.background.secondary,
                    borderTopWidth: 1,
                    borderTopColor: colors.border.dark,
                },
                headerStyle: {
                    backgroundColor: colors.background.secondary,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border.dark,
                },
                headerTintColor: colors.text.primary,
                headerTitleStyle: {
                    fontWeight: '600',
                    fontSize: 18,
                    color: colors.text.primary,
                },
            }}
        >
            <Tab.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ 
                    title: 'Главная',
                    tabBarLabel: 'Главная',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="home" size={size} color={color} />
                    ),
                }} 
            />
            <Tab.Screen 
                name="Cabinet" 
                component={CabinetNavigator}
                options={{ 
                    headerShown: false,
                    tabBarLabel: 'Кабинет',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }} 
            />
            {/* Показываем вкладку "Бизнес" только для владельцев бизнеса */}
            {isOwner && (
                <Tab.Screen 
                    name="Dashboard" 
                    component={DashboardScreen} 
                    options={{ 
                        title: 'Кабинет бизнеса',
                        tabBarLabel: 'Бизнес',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="business" size={size} color={color} />
                        ),
                    }} 
                />
            )}
            {/* Показываем вкладку "Сотрудник" только для сотрудников */}
            {isStaff && (
                <Tab.Screen 
                    name="Staff" 
                    component={StaffScreen} 
                    options={{ 
                        title: 'Кабинет сотрудника',
                        tabBarLabel: 'Сотрудник',
                        tabBarIcon: ({ color, size }) => (
                            <Ionicons name="briefcase" size={size} color={color} />
                        ),
                    }} 
                />
            )}
        </Tab.Navigator>
    );
}

