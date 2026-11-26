import { StyleSheet, Text } from 'react-native';

import { colors } from '../../constants/colors';
import { typeScale } from '../../constants/theme';

/**
 * One muted line of context at the top of a screen ("Салон «Бигуди» · Бишкек"). It replaces the
 * second big title screens used to repeat under the navigation header. Optional: skip it when
 * the header already says everything.
 */
export default function ScreenIntro({ children, testID }: { children: string; testID?: string }) {
    return (
        <Text style={styles.intro} numberOfLines={2} testID={testID}>
            {children}
        </Text>
    );
}

const styles = StyleSheet.create({
    intro: { ...typeScale.callout, fontWeight: '400', color: colors.text.secondary, marginBottom: -8 },
});
