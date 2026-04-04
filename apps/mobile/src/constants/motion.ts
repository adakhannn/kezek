import { Easing } from 'react-native';

import { colors } from './colors';

export const motion = {
    durations: {
        fast: colors.motion.fast,
        base: colors.motion.base,
        slow: colors.motion.slow,
    },
    pressScale: {
        subtle: 0.985,
        firm: 0.97,
    },
    offsets: {
        toastY: 12,
    },
    easing: {
        standard: Easing.out(Easing.cubic),
        emphasized: Easing.inOut(Easing.cubic),
    },
    spring: {
        damping: 18,
        stiffness: 280,
        mass: 0.7,
    },
} as const;
