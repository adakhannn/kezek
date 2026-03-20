import type { RouteProp } from '@react-navigation/native';
import type { ClientBookingDetailsDto } from '@shared-client/types';

export type BookingDetailsRouteParams = {
    id: string;
};

export type BookingDetailsScreenRouteProp = RouteProp<{ params: BookingDetailsRouteParams }, 'params'>;

export type BookingDetails = ClientBookingDetailsDto;
