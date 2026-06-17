import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import EmptyState from '../../components/ui/EmptyState';
import FeedbackBanner from '../../components/ui/FeedbackBanner';
import Input from '../../components/ui/Input';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import OfflineBanner, { OFFLINE_BANNER_DEFAULT } from '../../components/ui/OfflineBanner';
import Toast from '../../components/ui/Toast';

describe('UI primitive behavior contracts', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('Button blocks presses and exposes busy state while loading', () => {
        const onPress = jest.fn();
        render(<Button title="Сохранить" onPress={onPress} loading />);

        const button = screen.getByRole('button', { name: 'Сохранить' });
        expect(button.props.accessibilityState).toEqual(
            expect.objectContaining({ busy: true, disabled: true }),
        );

        fireEvent.press(button);
        expect(onPress).not.toHaveBeenCalled();
    });

    test('Input exposes disabled and invalid states with an announced error', () => {
        render(
            <Input
                label="Имя"
                value=""
                editable={false}
                error="Введите имя"
                onChangeText={jest.fn()}
            />,
        );

        expect(screen.getByLabelText('Имя').props.accessibilityState).toEqual(
            expect.objectContaining({ disabled: true, invalid: true }),
        );
        expect(screen.getByRole('alert').props.children).toBe('Введите имя');
    });

    test('a replacement Toast restarts its visibility duration', () => {
        jest.useFakeTimers();
        const onHide = jest.fn();
        const view = render(
            <Toast message="Первое сообщение" visible onHide={onHide} duration={3000} />,
        );

        act(() => {
            jest.advanceTimersByTime(2000);
        });
        view.rerender(
            <Toast message="Второе сообщение" visible onHide={onHide} duration={3000} />,
        );
        act(() => {
            jest.advanceTimersByTime(1100);
        });

        expect(onHide).not.toHaveBeenCalled();
        expect(screen.getByText('Второе сообщение')).toBeTruthy();

        act(() => {
            jest.advanceTimersByTime(2100);
        });
        expect(onHide).toHaveBeenCalledTimes(1);
    });

    test('FeedbackBanner provides an accessible close action', () => {
        const onClose = jest.fn();
        render(
            <FeedbackBanner
                variant="danger"
                message="Не удалось сохранить"
                onClose={onClose}
            />,
        );

        fireEvent.press(screen.getByRole('button', { name: 'Закрыть уведомление' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('OfflineBanner uses shared feedback behavior and exposes retry', () => {
        const onRetry = jest.fn();
        render(<OfflineBanner onRetry={onRetry} />);

        expect(screen.getByText(OFFLINE_BANNER_DEFAULT.title)).toBeTruthy();
        expect(screen.getByText(OFFLINE_BANNER_DEFAULT.messageWithRetry)).toBeTruthy();
        fireEvent.press(screen.getByRole('button', { name: 'Обновить' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('Card forwards semantic view props without changing its content contract', () => {
        render(
            <Card testID="summary-card" accessibilityLabel="Сводка записи" variant="outlined">
                <Text>Содержимое</Text>
            </Card>,
        );

        expect(screen.getByTestId('summary-card').props.accessibilityLabel).toBe('Сводка записи');
        expect(screen.getByText('Содержимое')).toBeTruthy();
    });
    test('LoadingSpinner announces loading progress and busy state', () => {
        render(<LoadingSpinner message="Загрузка записей" />);

        const progress = screen.getByRole('progressbar', { name: 'Загрузка записей' });
        expect(progress.props.accessibilityLiveRegion).toBe('polite');
        expect(progress.props.accessibilityState).toEqual(
            expect.objectContaining({ busy: true }),
        );
    });

    test('EmptyState groups its summary without hiding the action', () => {
        const onPress = jest.fn();
        render(
            <EmptyState
                title="Нет записей"
                message="Создайте первую запись"
                action={<Button title="Создать запись" onPress={onPress} />}
            />,
        );

        expect(screen.getByLabelText('Нет записей. Создайте первую запись')).toBeTruthy();
        fireEvent.press(screen.getByRole('button', { name: 'Создать запись' }));
        expect(onPress).toHaveBeenCalledTimes(1);
    });
});
