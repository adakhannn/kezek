import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import { MainTabParamList, CabinetStackParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CabinetScreen from '../screens/CabinetScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StaffScreen from '../screens/StaffScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const CabinetStack = createNativeStackNavigator<CabinetStackParamList>();

function CabinetNavigator() {
    return (
        <CabinetStack.Navigator>
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
                component={CabinetNavigator}
                options={{ 
                    headerShown: false,
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

