import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import MotionPressable from '../../components/ui/MotionPressable';
import { colors } from '../../constants/colors';
import { useLanguage } from '../../i18n';
import type { RootStackParamList } from '../../navigation/types';
import type { RoleApplicationMode } from './applicationModel';
import { applyStyles as styles } from './applyStyles';

const CARDS: { mode: RoleApplicationMode; prefix: 'parity.roleApply.owner' | 'parity.roleApply.staff' }[] = [
    { mode: 'owner', prefix: 'parity.roleApply.owner' },
    { mode: 'staff', prefix: 'parity.roleApply.staff' },
];

/** The website's /business/role-apply: choose an owner or a staff application. */
export default function RoleApplyScreen() {
    const { t } = useLanguage();
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content} testID="role-apply-screen">
            {/* The header says "Доступ к бизнесу": the screen opens with one line of context. */}
            <View style={styles.intro}>
                <Text style={styles.description}>{t('parity.roleApply.description')}</Text>
            </View>

            {CARDS.map(({ mode, prefix }) => (
                <MotionPressable
                    key={mode}
                    onPress={() => navigation.navigate('RoleApplication', { mode })}
                    accessibilityRole="button"
                    accessibilityLabel={t(`${prefix}.title`)}
                    accessibilityHint={t('parity.roleApply.open')}
                    scale="firm"
                    testID={`role-apply-${mode}`}
                >
                    <Card variant="plain" padding="md" style={styles.cardGap}>
                        <View style={styles.row}>
                            <Text style={styles.eyebrow}>{t(`${prefix}.eyebrow`)}</Text>
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{t(`${prefix}.badge`)}</Text>
                            </View>
                        </View>
                        <Text style={styles.sectionTitle}>{t(`${prefix}.title`)}</Text>
                        <Text style={styles.hint}>{t(`${prefix}.description`)}</Text>
                        <View style={styles.rowStart}>
                            <Text style={styles.link}>{t('parity.roleApply.open')}</Text>
                            <Ionicons name="arrow-forward" size={16} color={colors.tone.accent.fg} />
                        </View>
                    </Card>
                </MotionPressable>
            ))}

            <Text style={[styles.hint, styles.center]}>{t('parity.roleApply.newBusiness.prefix')}</Text>
            <Button
                title={t('parity.roleApply.form.connectBusiness')}
                onPress={() => navigation.navigate('BusinessApply')}
                variant="outline"
                fullWidth
            />
        </ScrollView>
    );
}
