import { useEffect, type ComponentType } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useUserRole } from '../hooks/useUserRole';
import type { RootStackParamList } from './types';

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function withStaffRouteGuard(Screen: ComponentType) {
    function StaffRouteGuard() {
        const navigation = useNavigation<RootNavigation>();
        const { isStaff, isLoading } = useUserRole();

        useEffect(() => {
            if (!isLoading && !isStaff) {
                navigation.replace('Main', { screen: 'Home' });
            }
        }, [isLoading, isStaff, navigation]);

        if (isLoading || !isStaff) {
            return <LoadingSpinner message="Проверяем доступ..." />;
        }

        return <Screen />;
    }

    StaffRouteGuard.displayName = `StaffRouteGuard(${Screen.displayName || Screen.name || 'Screen'})`;
    return StaffRouteGuard;
}
