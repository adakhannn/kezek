import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../../../constants/colors';

export default function AuthHeroBadge() {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={[colors.brand.primaryFrom, colors.brand.primaryTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.badge}
      >
        <Ionicons name="sparkles-outline" size={26} color={colors.text.light} />
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...colors.shadow.md,
  },
});
