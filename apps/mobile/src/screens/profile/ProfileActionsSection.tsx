import { View } from 'react-native';

import Button from '../../components/ui/Button';

import { styles } from './styles';

export function ProfileActionsSection({
    saving,
    onSave,
    onSignOut,
}: {
    saving: boolean;
    onSave: () => void;
    onSignOut: () => void;
}) {
    return (
        <View style={styles.actions}>
            <Button
                title="РЎРѕС…СЂР°РЅРёС‚СЊ"
                onPress={onSave}
                loading={saving}
                disabled={saving}
            />

            <Button
                title="Р’С‹Р№С‚Рё"
                onPress={onSignOut}
                variant="outline"
                style={styles.signOutButton}
            />
        </View>
    );
}
