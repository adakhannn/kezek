import { View, Text, Switch } from 'react-native';

import Card from '../../components/ui/Card';

import { styles } from './styles';

export function ProfileNotificationsSection({
    notifyEmail,
    notifyWhatsApp,
    onChangeNotifyEmail,
    onChangeNotifyWhatsApp,
}: {
    notifyEmail: boolean;
    notifyWhatsApp: boolean;
    onChangeNotifyEmail: (value: boolean) => void;
    onChangeNotifyWhatsApp: (value: boolean) => void;
}) {
    return (
        <Card style={styles.card}>
            <Text style={styles.sectionTitle}>РЈРІРµРґРѕРјР»РµРЅРёСЏ</Text>

            <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                    <Text style={styles.switchLabel}>Email СѓРІРµРґРѕРјР»РµРЅРёСЏ</Text>
                    <Text style={styles.switchHint}>РџРѕР»СѓС‡Р°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ РЅР° email</Text>
                </View>
                <Switch
                    value={notifyEmail}
                    onValueChange={onChangeNotifyEmail}
                    trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                    thumbColor="#fff"
                />
            </View>

            <View style={styles.switchRow}>
                <View style={styles.switchLabelContainer}>
                    <Text style={styles.switchLabel}>WhatsApp СѓРІРµРґРѕРјР»РµРЅРёСЏ</Text>
                    <Text style={styles.switchHint}>РџРѕР»СѓС‡Р°С‚СЊ СѓРІРµРґРѕРјР»РµРЅРёСЏ РІ WhatsApp</Text>
                </View>
                <Switch
                    value={notifyWhatsApp}
                    onValueChange={onChangeNotifyWhatsApp}
                    trackColor={{ false: '#d1d5db', true: '#6366f1' }}
                    thumbColor="#fff"
                />
            </View>
        </Card>
    );
}
