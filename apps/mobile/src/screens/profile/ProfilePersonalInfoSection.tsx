import { View, Text } from 'react-native';

import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';

import { styles } from './styles';

export function ProfilePersonalInfoSection({
    fullName,
    phone,
    email,
    onChangeFullName,
    onChangePhone,
}: {
    fullName: string;
    phone: string;
    email?: string | null;
    onChangeFullName: (value: string) => void;
    onChangePhone: (value: string) => void;
}) {
    return (
        <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Р›РёС‡РЅР°СЏ РёРЅС„РѕСЂРјР°С†РёСЏ</Text>

            <Input
                label="РРјСЏ"
                placeholder="Р’РІРµРґРёС‚Рµ РІР°С€Рµ РёРјСЏ"
                value={fullName}
                onChangeText={onChangeFullName}
            />

            <Input
                label="РўРµР»РµС„РѕРЅ"
                placeholder="+996500574029"
                value={phone}
                onChangeText={onChangePhone}
                keyboardType="phone-pad"
            />

            {email && (
                <View style={styles.emailContainer}>
                    <Text style={styles.label}>Email</Text>
                    <Text style={styles.emailValue}>{email}</Text>
                    <Text style={styles.emailHint}>Email РЅРµР»СЊР·СЏ РёР·РјРµРЅРёС‚СЊ</Text>
                </View>
            )}
        </Card>
    );
}
