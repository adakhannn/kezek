import type { CreateGuestBookingParams } from '@core-domain/booking';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SupabaseBranchRepository } from '@/lib/repositories';

import { createSupabaseGuestBookingCommands } from './guestBookingCommandsSupabase';

type CreateGuestBookingApplicationDeps = {
    supabase: SupabaseClient;
    notifications?: {
        send(bookingId: string, type: 'hold' | 'confirm' | 'cancel'): Promise<void>;
    };
};

export type CreateGuestBookingApplicationResult =
    | {
          ok: true;
          bookingId: string;
          confirmed: true;
      }
    | {
          ok: false;
          code: 'no_branch' | 'rpc_shape' | 'rpc';
          message: string;
      };

export async function createGuestBookingApplication(
    deps: CreateGuestBookingApplicationDeps,
    params: CreateGuestBookingParams,
): Promise<CreateGuestBookingApplicationResult> {
    const branchRepository = new SupabaseBranchRepository(deps.supabase);
    const commands = createSupabaseGuestBookingCommands(deps.supabase);

    const branch = await branchRepository.findActiveById({
        bizId: params.biz_id,
        branchId: params.branch_id,
    });

    if (!branch?.id) {
        return {
            ok: false,
            code: 'no_branch',
            message: 'Филиал не найден или неактивен',
        };
    }

    try {
        const bookingId = await commands.holdGuestSlot({
            ...params,
            branch_id: branch.id,
        });

        await commands.confirmBooking(bookingId);

        if (deps.notifications) {
            await deps.notifications.send(bookingId, 'confirm');
        }

        return {
            ok: true,
            bookingId,
            confirmed: true,
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Не удалось создать бронирование';
        const code = message === 'Unexpected RPC result shape' ? 'rpc_shape' : 'rpc';

        return {
            ok: false,
            code,
            message,
        };
    }
}
