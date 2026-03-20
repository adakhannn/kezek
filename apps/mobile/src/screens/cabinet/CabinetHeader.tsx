import { Text, View } from 'react-native';
import type { User } from '@supabase/supabase-js';

import { styles } from './styles';

export function CabinetHeader({ user }: { user: User | null | undefined }) {
    return (
        <View style={styles.header}>
            <Text style={styles.title}>Личный кабинет</Text>
            {user && <Text style={styles.subtitle}>{user.email || user.phone || 'Пользователь'}</Text>}
        </View>
    );
}
