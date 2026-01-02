import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from './types';
import HomeScreen from '../screens/HomeScreen';
import CabinetScreen from '../screens/CabinetScreen';
import DashboardScreen from '../screens/DashboardScreen';
import StaffScreen from '../screens/StaffScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainNavigator() {
    return (
        <Tab.Navigator>
            <Tab.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ title: 'Главная' }} 
            />
            <Tab.Screen 
                name="Cabinet" 
                component={CabinetScreen} 
                options={{ title: 'Кабинет' }} 
            />
            <Tab.Screen 
                name="Dashboard" 
                component={DashboardScreen} 
                options={{ title: 'Бизнес' }} 
            />
            <Tab.Screen 
                name="Staff" 
                component={StaffScreen} 
                options={{ title: 'Сотрудник' }} 
            />
        </Tab.Navigator>
    );
}

