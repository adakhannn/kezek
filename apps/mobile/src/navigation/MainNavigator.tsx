import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CabinetScreen from '../screens/CabinetScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StaffScreen from '../screens/StaffScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                tabBarActiveTintColor: '#6366f1',
                tabBarInactiveTintColor: '#9ca3af',
                headerStyle: {
                    backgroundColor: '#fff',
                },
                headerTintColor: '#111827',
            }}
        >
            <Tab.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ 
                    title: 'Главная',
                    tabBarLabel: 'Главная',
                }} 
            />
            <Tab.Screen 
                name="Cabinet" 
                component={CabinetScreen} 
                options={{ 
                    title: 'Личный кабинет',
                    tabBarLabel: 'Кабинет',
                }} 
            />
            <Tab.Screen 
                name="Dashboard" 
                component={DashboardScreen} 
                options={{ 
                    title: 'Кабинет бизнеса',
                    tabBarLabel: 'Бизнес',
                }} 
            />
            <Tab.Screen 
                name="Staff" 
                component={StaffScreen} 
                options={{ 
                    title: 'Кабинет сотрудника',
                    tabBarLabel: 'Сотрудник',
                }} 
            />
        </Tab.Navigator>
    );
}

