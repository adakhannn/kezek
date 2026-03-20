import LoadingSpinner from '../../components/ui/LoadingSpinner';
import EmptyState from '../../components/ui/EmptyState';

type DashboardScreenStateProps = {
    type: 'loading' | 'not-owner' | 'empty';
};

export function DashboardScreenState({ type }: DashboardScreenStateProps) {
    if (type === 'loading') {
        return <LoadingSpinner message="Загрузка..." />;
    }

    if (type === 'not-owner') {
        return (
            <EmptyState
                icon="business"
                title="Вы не являетесь владельцем бизнеса"
                message="Здесь будут отображаться ваши бизнесы после регистрации"
            />
        );
    }

    return (
        <EmptyState
            icon="business"
            title="Нет бизнесов"
            message="Зарегистрируйте бизнес, чтобы начать управление"
        />
    );
}
