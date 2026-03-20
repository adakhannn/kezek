import { ScrollView } from 'react-native';

import EmptyState from '../../components/ui/EmptyState';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { styles } from './styles';

type Props = {
    mode: 'loading' | 'not-staff' | 'error';
};

export function ShiftQuickScreenState({ mode }: Props) {
    if (mode === 'loading') {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (mode === 'not-staff') {
        return (
            <ScrollView style={styles.container}>
                <EmptyState
                    icon="briefcase"
                    title="Вы не являетесь сотрудником"
                    message="Здесь будет отображаться управление сменой после назначения сотрудником"
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <EmptyState
                icon="alert-circle"
                title="Ошибка загрузки"
                message="Не удалось загрузить данные смены. Проверьте подключение к интернету."
            />
        </ScrollView>
    );
}
