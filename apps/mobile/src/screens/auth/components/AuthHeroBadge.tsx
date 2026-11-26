import { StyleSheet, View } from 'react-native';

import Logo from '../../../components/Logo';

/** The brand at the top of the sign-in card (the logo, not a generic icon). */
export default function AuthHeroBadge() {
  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="Kezek">
      <Logo />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
