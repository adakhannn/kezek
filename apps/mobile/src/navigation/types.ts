import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
    Auth: undefined;
    Main: NavigatorScreenParams<MainTabParamList>;
    BookingDetails: { id: string };
    Booking: { slug: string };
};

export type MainTabParamList = {
    Home: undefined;
    Cabinet: undefined;
    Dashboard: undefined;
    Staff: undefined;
};

export type AuthStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    Verify: { phone?: string; email?: string };
};

