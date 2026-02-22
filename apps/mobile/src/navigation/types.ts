import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
    Auth: undefined;
    Main: NavigatorScreenParams<MainTabParamList>;
    BookingDetails: { id: string };
    Booking: { slug: string };
    BookingStep1Branch: { slug: string };
    BookingStep2Service: undefined;
    BookingStep3Staff: undefined;
    BookingStep4Date: undefined;
    BookingStep5Time: undefined;
    BookingStep6Confirm: undefined;
    Shifts: undefined;
};

export type MainTabParamList = {
    Home: undefined;
    Cabinet: NavigatorScreenParams<CabinetStackParamList>;
    Dashboard: undefined;
    Staff: undefined;
    Shifts: undefined;
    ShiftDetails: { shiftId: string };
    ShiftQuick: undefined;
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

