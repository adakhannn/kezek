import { useRef } from 'react';
import {
    Animated,
    Pressable,
    PressableProps,
    StyleProp,
    ViewStyle,
} from 'react-native';

import { motion } from '../../constants/motion';

type MotionPressableProps = PressableProps & {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    scale?: 'subtle' | 'firm';
};

export default function MotionPressable({
    children,
    style,
    disabled,
    scale = 'subtle',
    onPressIn,
    onPressOut,
    ...props
}: MotionPressableProps) {
    const animatedScale = useRef(new Animated.Value(1)).current;
    const accessibilityState = {
        ...props.accessibilityState,
        disabled: disabled ?? props.accessibilityState?.disabled,
    };

    const runScale = (toValue: number) => {
        Animated.spring(animatedScale, {
            toValue,
            useNativeDriver: true,
            damping: motion.spring.damping,
            stiffness: motion.spring.stiffness,
            mass: motion.spring.mass,
        }).start();
    };

    return (
        <Pressable
            {...props}
            disabled={disabled}
            accessibilityRole={props.accessibilityRole ?? 'button'}
            accessibilityState={accessibilityState}
            onPressIn={(event) => {
                if (!disabled) {
                    runScale(motion.pressScale[scale]);
                }
                onPressIn?.(event);
            }}
            onPressOut={(event) => {
                runScale(1);
                onPressOut?.(event);
            }}
        >
            <Animated.View style={[style, { transform: [{ scale: animatedScale }] }]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
