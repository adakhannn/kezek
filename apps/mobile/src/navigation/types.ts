import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
    Auth: undefined;
    Main: NavigatorScreenParams<MainTabParamList>;
    BookingDetails: { id: string };
    Booking: { slug: string };
};

export type MainTabParamList = {
    Home: undefined;
    Cabinet: NavigatorScreenParams<CabinetStackParamList>;
    Dashboard: undefined;
    Staff: undefined;
};

export type CabinetStackParamList = {
    CabinetMain: undefined;
    Profile: undefined;
};

export type AuthStackParamList = {
    SignIn: undefined;
    SignUp: undefined;
    Verify: { phone?: string; email?: string };
    WhatsApp: undefined;
};

