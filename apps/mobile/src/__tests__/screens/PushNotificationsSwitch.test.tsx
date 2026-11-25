import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { disablePushNotifications, enablePushNotifications, readPushEnabled } from '../../lib/pushNotifications';
import { PushNotificationsSwitch } from '../../screens/profile/PushNotificationsSwitch';

const mockShowToast = jest.fn();

jest.mock('../../contexts/ToastContext', () => ({ useToast: () => ({ showToast: mockShowToast }) }));
jest.mock('../../lib/pushNotifications', () => ({
    readPushEnabled: jest.fn(),
    enablePushNotifications: jest.fn(),
    disablePushNotifications: jest.fn(),
}));

const toggle = async (value: boolean) => {
    await act(async () => { fireEvent(screen.getByTestId('profile-push-switch'), 'valueChange', value); });
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(readPushEnabled).mockResolvedValue(false);
    jest.mocked(enablePushNotifications).mockResolvedValue('enabled');
    jest.mocked(disablePushNotifications).mockResolvedValue(undefined);
});

test('shows the switch with the state of this install for the account', async () => {
    jest.mocked(readPushEnabled).mockResolvedValue(true);
    render(<PushNotificationsSwitch userId="user-1" />);
    expect(screen.getByText('Push-уведомления')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('profile-push-switch').props.value).toBe(true));
    expect(readPushEnabled).toHaveBeenCalledWith('user-1');
});

test('turning it on registers; turning it off unregisters', async () => {
    render(<PushNotificationsSwitch userId="user-1" />);
    await toggle(true);
    expect(enablePushNotifications).toHaveBeenCalledWith('user-1');
    expect(screen.getByTestId('profile-push-switch').props.value).toBe(true);
    await toggle(false);
    expect(disablePushNotifications).toHaveBeenCalledWith('user-1');
    expect(screen.getByTestId('profile-push-switch').props.value).toBe(false);
});

test('a refused permission leaves it off and offers the phone settings', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.mocked(enablePushNotifications).mockResolvedValue('denied');
    render(<PushNotificationsSwitch userId="user-1" />);
    await toggle(true);
    expect(screen.getByTestId('profile-push-switch').props.value).toBe(false);
    expect(alert).toHaveBeenCalledWith('Уведомления выключены', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Открыть настройки' })]));
    alert.mockRestore();
});

test('a server error keeps the previous state and says so', async () => {
    jest.mocked(readPushEnabled).mockResolvedValue(true);
    jest.mocked(disablePushNotifications).mockRejectedValue(new Error('offline'));
    render(<PushNotificationsSwitch userId="user-1" />);
    await waitFor(() => expect(screen.getByTestId('profile-push-switch').props.value).toBe(true));
    await toggle(false);
    expect(screen.getByTestId('profile-push-switch').props.value).toBe(true);
    expect(mockShowToast).toHaveBeenCalledWith('Не удалось изменить настройку. Проверьте интернет и попробуйте снова.', 'error');
});

test('without a signed-in user it is disabled', () => {
    render(<PushNotificationsSwitch userId={undefined} />);
    expect(screen.getByTestId('profile-push-switch').props.disabled).toBe(true);
    expect(readPushEnabled).not.toHaveBeenCalled();
});
