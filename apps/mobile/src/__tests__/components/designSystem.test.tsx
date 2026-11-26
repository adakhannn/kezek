import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';

import Avatar, { initialsOf } from '../../components/ui/Avatar';
import ChipGroup from '../../components/ui/ChipGroup';
import { DateField, DateNavigator, DateRangeField, TimeField } from '../../components/ui/DateTimeFields';
import ErrorState from '../../components/ui/ErrorState';
import FormField from '../../components/ui/FormField';
import ListRow, { KeyValueRow, ListGroup } from '../../components/ui/ListRow';
import Screen from '../../components/ui/Screen';
import Section from '../../components/ui/Section';
import { CheckboxRow, SwitchRow } from '../../components/ui/SelectionRow';
import SegmentedTabs from '../../components/SegmentedTabs';
import { checkAvatarFile, MAX_AVATAR_BYTES } from '../../lib/staffAvatar';
import { StaffAvatarEditor } from '../../screens/staff/StaffAvatarEditor';
import {
    clampYmd,
    formatYmdLabel,
    hmToPickerDate,
    isHm,
    isYmd,
    pickerDateToHm,
    pickerDateToYmd,
    ymdToPickerDate,
} from '../../utils/pickerValues';

jest.mock('@tanstack/react-query', () => ({
    ...jest.requireActual('@tanstack/react-query'),
    useQueryClient: () => ({ invalidateQueries: jest.fn(async () => undefined) }),
}));

/** Picks `date` in the open iOS picker sheet and confirms it. */
function pickInSheet(date: Date) {
    fireEvent(screen.getByTestId('native-date-time-picker'), 'change', { type: 'set' }, date);
    fireEvent.press(screen.getByTestId('picker-done'));
}

describe('picker values', () => {
    test('a business date survives the trip through the local picker date', () => {
        expect(pickerDateToYmd(ymdToPickerDate('2026-03-29'))).toBe('2026-03-29');
        expect(pickerDateToHm(hmToPickerDate('09:05'))).toBe('09:05');
        expect(isYmd('2026-02-30')).toBe(false);
        expect(isYmd('2026-02-28')).toBe(true);
        expect(isHm('24:00')).toBe(false);
        expect(clampYmd('2026-01-01', '2026-02-01')).toBe('2026-02-01');
        expect(clampYmd('2026-05-01', undefined, '2026-04-30')).toBe('2026-04-30');
    });

    test('labels follow the app language', () => {
        expect(formatYmdLabel('2026-11-26', 'ru')).toBe('Чт, 26 ноября 2026');
        expect(formatYmdLabel('2026-11-26', 'en')).toBe('Thu, Nov 26, 2026');
        expect(formatYmdLabel('2026-11-26', 'ky', { weekday: false })).toBe('2026-ж., 26-ноябрь');
        expect(formatYmdLabel('2026-11-26', 'ru', { weekday: false, year: false })).toBe('26 ноября');
    });
});

describe('date and time fields', () => {
    test('DateField opens the calendar and reports the picked day within the bounds', () => {
        const onChange = jest.fn();
        render(<DateField label="Дата" value="2026-11-26" onChange={onChange} maxDate="2026-12-31" testID="d" />);
        expect(screen.getByText('Чт, 26 ноября 2026')).toBeTruthy();
        fireEvent.press(screen.getByTestId('d'));
        pickInSheet(new Date(2027, 0, 5, 12));
        expect(onChange).toHaveBeenCalledWith('2026-12-31');
    });

    test('an optional DateField can be cleared and shows a placeholder when empty', () => {
        const onChange = jest.fn();
        const { rerender } = render(<DateField value="2026-11-26" onChange={onChange} clearable testID="d" />);
        fireEvent.press(screen.getByTestId('d-clear'));
        expect(onChange).toHaveBeenCalledWith('');
        rerender(<DateField value="" onChange={onChange} clearable testID="d" />);
        expect(screen.getByText('Выберите дату')).toBeTruthy();
        expect(screen.queryByTestId('d-clear')).toBeNull();
    });

    test('TimeField picks a 24-hour time', () => {
        const onChange = jest.fn();
        render(<TimeField label="Начало" value="09:00" onChange={onChange} compact testID="t" />);
        expect(screen.getByLabelText('Начало: 09:00')).toBeTruthy();
        fireEvent.press(screen.getByTestId('t'));
        pickInSheet(new Date(2000, 0, 1, 18, 30));
        expect(onChange).toHaveBeenCalledWith('18:30');
    });

    test('DateRangeField moves the end when the start passes it', () => {
        function Range() {
            const [range, setRange] = useState({ from: '2026-11-01', to: '2026-11-10' });
            return <DateRangeField from={range.from} to={range.to} onChange={setRange} testID="r" />;
        }
        render(<Range />);
        fireEvent.press(screen.getByTestId('r-from'));
        pickInSheet(new Date(2026, 10, 20, 12));
        expect(screen.getByLabelText('С: 20 ноября 2026')).toBeTruthy();
        expect(screen.getByLabelText('По: 20 ноября 2026')).toBeTruthy();
    });

    test('DateNavigator steps by day and its label opens the calendar', () => {
        const onChange = jest.fn();
        render(<DateNavigator value="2026-11-26" onChange={onChange} minDate="2026-11-26" testID="n" />);
        expect(screen.getByTestId('n-prev').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
        fireEvent.press(screen.getByTestId('n-next'));
        expect(onChange).toHaveBeenLastCalledWith('2026-11-27');
        fireEvent.press(screen.getByTestId('n-open'));
        pickInSheet(new Date(2026, 11, 3, 12));
        expect(onChange).toHaveBeenLastCalledWith('2026-12-03');
    });
});

describe('layout and selection components', () => {
    test('ChipGroup: single choice reports one key, multi choice toggles', () => {
        const onSingle = jest.fn();
        const onMulti = jest.fn();
        const options = [{ key: 'a', label: 'Все', count: 3 }, { key: 'b', label: 'Активные' }] as const;
        render(
            <>
                <ChipGroup options={options} value="a" onChange={onSingle} testID="s" />
                <ChipGroup multiple options={options} value={['a']} onChange={onMulti} testID="m" />
            </>,
        );
        expect(screen.getByTestId('s-a').props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
        fireEvent.press(screen.getByTestId('s-b'));
        expect(onSingle).toHaveBeenCalledWith('b');
        fireEvent.press(screen.getByTestId('m-a'));
        expect(onMulti).toHaveBeenCalledWith([]);
        fireEvent.press(screen.getByTestId('m-b'));
        expect(onMulti).toHaveBeenLastCalledWith(['a', 'b']);
    });

    test('SegmentedTabs keep labels on one line and scroll with more than three tabs', () => {
        const tabs = [1, 2, 3, 4].map((n) => ({ key: `k${n}`, label: `Вкладка ${n}` }));
        render(<SegmentedTabs tabs={tabs} value="k1" onChange={jest.fn()} testID="tabs" />);
        expect(screen.getByText('Вкладка 4').props.numberOfLines).toBe(1);
        expect(screen.getByTestId('tabs').type).toBe('RCTScrollView');
    });

    test('ListRow, switches and checkboxes toggle as whole rows', () => {
        const onPress = jest.fn();
        const onSwitch = jest.fn();
        const onCheck = jest.fn();
        render(
            <Screen>
                <Section title="Настройки" actionLabel="Все" onAction={jest.fn()}>
                    <ListGroup>
                        <ListRow title="Сотрудники" value="12" icon="people" onPress={onPress} testID="row" />
                        <ListRow title="Онлайн-запись" switchValue={false} onSwitchChange={onSwitch} testID="sw" />
                    </ListGroup>
                    <KeyValueRow label="Итого" value="1 500 сом" emphasis />
                    <SwitchRow label="Активна" value onChange={onSwitch} testID="switch-row" />
                    <CheckboxRow label="Центр" checked={false} onChange={onCheck} testID="check" />
                </Section>
            </Screen>,
        );
        fireEvent.press(screen.getByTestId('row'));
        fireEvent.press(screen.getByTestId('sw'));
        fireEvent.press(screen.getByTestId('switch-row'));
        fireEvent.press(screen.getByTestId('check'));
        expect(onPress).toHaveBeenCalled();
        expect(onSwitch).toHaveBeenNthCalledWith(1, true);
        expect(onSwitch).toHaveBeenNthCalledWith(2, false);
        expect(onCheck).toHaveBeenCalledWith(true);
        expect(screen.getByLabelText('Итого: 1 500 сом')).toBeTruthy();
    });

    test('FormField shows the unit and reads it aloud with the label', () => {
        render(<FormField label="Цена от" suffix="сом" value="" onChangeText={jest.fn()} required />);
        expect(screen.getByText('сом')).toBeTruthy();
        expect(screen.getByLabelText('Цена от, сом')).toBeTruthy();
    });

    test('ErrorState defaults to the translated failure copy with a retry', () => {
        const onRetry = jest.fn();
        render(<ErrorState onRetry={onRetry} />);
        fireEvent.press(screen.getByText('Повторить'));
        expect(onRetry).toHaveBeenCalled();
        expect(screen.getByLabelText(/Не удалось загрузить/)).toBeTruthy();
    });

    test('Avatar falls back to initials', () => {
        expect(initialsOf('Айгерим Касымова')).toBe('АК');
        expect(initialsOf('Bolot')).toBe('BO');
        expect(initialsOf('')).toBe('?');
        render(<Avatar name="Айгерим Касымова" />);
        expect(screen.getByText('АК', { includeHiddenElements: true })).toBeTruthy();
    });
});

describe('master photo upload', () => {
    test('the website limits: images only, at most 5 MB', () => {
        expect(checkAvatarFile({ uri: 'x', mimeType: 'image/jpeg', fileSize: MAX_AVATAR_BYTES })).toBe('ok');
        expect(checkAvatarFile({ uri: 'x', mimeType: 'image/jpeg', fileSize: MAX_AVATAR_BYTES + 1 })).toBe('tooLarge');
        expect(checkAvatarFile({ uri: 'x', mimeType: 'video/mp4' })).toBe('notImage');
        expect(checkAvatarFile({ uri: 'x' })).toBe('ok');
    });

    test('a too large photo is refused before any upload, with a square crop requested', async () => {
        (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file:///big.jpg', mimeType: 'image/jpeg', fileSize: MAX_AVATAR_BYTES + 10 }],
        });
        render(<StaffAvatarEditor staffId="staff-1" name="Азамат Касымов" avatarUrl={null} />);
        expect(screen.getByText('АК', { includeHiddenElements: true })).toBeTruthy();
        fireEvent.press(screen.getByTestId('staff-avatar-upload'));
        expect(await screen.findByText('Файл больше 5 МБ. Выберите другое фото.')).toBeTruthy();
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: true, aspect: [1, 1] }));
    });

    test('a current photo offers change and remove', () => {
        render(<StaffAvatarEditor staffId="staff-1" name="Азамат" avatarUrl="https://cdn/a.jpg" />);
        expect(screen.getByText('Сменить фото')).toBeTruthy();
        expect(screen.getByText('Удалить фото')).toBeTruthy();
    });
});
