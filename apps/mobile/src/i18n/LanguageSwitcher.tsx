import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MIN_TOUCH_TARGET } from '../constants/accessibility';
import { colors } from '../constants/colors';
import { typography } from '../constants/typography';
import { LANGUAGE_NAMES, LANGUAGE_SHORT_LABELS } from './dictionaries/languageNames';
import { LOCALES } from './locale';
import { useLanguage } from './LanguageProvider';

/** KG / RU / EN, as on the website. Used on the Profile screen and the sign-in screen. */
export function LanguageSwitcher({ style }: { style?: StyleProp<ViewStyle> }) {
    const { locale, setLocale, t } = useLanguage();

    return (
        <View
            accessibilityRole="radiogroup"
            accessibilityLabel={t('common.language.title')}
            style={[styles.group, style]}
            testID="language-switcher"
        >
            {LOCALES.map((code) => {
                const active = code === locale;
                return (
                    <Pressable
                        key={code}
                        accessibilityRole="radio"
                        accessibilityLabel={LANGUAGE_NAMES[code]}
                        accessibilityState={{ selected: active, checked: active }}
                        onPress={() => setLocale(code)}
                        hitSlop={4}
                        style={({ pressed }) => [
                            styles.option,
                            active ? styles.optionActive : null,
                            pressed && !active ? styles.optionPressed : null,
                        ]}
                        testID={`language-option-${code}`}
                    >
                        <Text style={[styles.label, active ? styles.labelActive : null]}>
                            {LANGUAGE_SHORT_LABELS[code]}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    group: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        gap: colors.layout.space1,
        padding: colors.layout.space1,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: colors.border.subtle,
        backgroundColor: colors.surface.emphasis,
    },
    option: {
        minWidth: MIN_TOUCH_TARGET,
        minHeight: MIN_TOUCH_TARGET - 8,
        paddingHorizontal: colors.layout.space3,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    optionActive: {
        backgroundColor: colors.surface.card,
    },
    optionPressed: {
        opacity: 0.7,
    },
    label: {
        ...typography.label,
        color: colors.text.secondary,
    },
    labelActive: {
        color: colors.text.primary,
    },
});
