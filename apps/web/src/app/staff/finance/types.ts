// apps/web/src/app/staff/finance/types.ts

/**
 * Типы для финансового модуля
 * 
 * ВАЖНО: ShiftItem теперь генерируется из Zod-схемы для обеспечения синхронизации
 * типов и валидации. Используйте типы из @/lib/validation/types.
 */

// Импортируем типы из validation
import type { ShiftItem as ValidationShiftItem } from '@/lib/validation/types';

// Реэкспортируем типы из validation для единообразия
export type { ShiftItem, SaveShiftItemsRequest, CloseShiftRequest } from '@/lib/validation/types';

/**
 * Расширенный тип ShiftItem для использования на фронтенде
 * Добавляет поля, которые могут быть использованы в UI, но не отправляются на сервер
 */
export type ShiftItemExtended = ValidationShiftItem & {
    // Дополнительные поля для UI (не валидируются на сервере)
    _isNew?: boolean;
    _isEditing?: boolean;
    _isSaving?: boolean;
};

export type ServiceName = {
    name_ru: string;
    name_ky?: string | null;
    name_en?: string | null;
};

export type Booking = {
    id: string;
    client_name: string | null;
    client_phone: string | null;
    start_at: string;
    services: ServiceName | ServiceName[] | null;
};

export type Shift = {
    id: string;
    shift_date: string;
    opened_at: string | null;
    closed_at: string | null;
    expected_start: string | null;
    late_minutes: number;
    status: 'open' | 'closed';
    total_amount: number;
    consumables_amount: number;
    master_share: number;
    salon_share: number;
    percent_master: number;
    percent_salon: number;
    hours_worked?: number | null;
    hourly_rate?: number | null;
    guaranteed_amount?: number;
    topup_amount?: number;
};

export type Stats = {
    totalAmount: number;
    totalMaster: number;
    totalSalon: number;
    totalLateMinutes: number;
    shiftsCount: number;
};

export type TodayResponse =
    | {
          ok: true;
          today:
              | { exists: false; status: 'none'; shift: null; items: ValidationShiftItem[] }
              | { exists: true; status: 'open' | 'closed'; shift: Shift; items: ValidationShiftItem[] };
          bookings?: Booking[];
          services?: ServiceName[] | string[]; // Поддержка старого (string[]) и нового (ServiceName[]) форматов
          allShifts?: Array<{
              shift_date: string;
              status: string;
              total_amount: number;
              master_share: number;
              salon_share: number;
              late_minutes: number;
              guaranteed_amount?: number;
              topup_amount?: number;
          }>;
          staffPercentMaster?: number;
          staffPercentSalon?: number;
          hourlyRate?: number | null;
          currentHoursWorked?: number | null;
          currentGuaranteedAmount?: number | null;
          isDayOff?: boolean;
          stats: Stats;
      }
    | { ok: false; error: string };

export type TabKey = 'shift' | 'clients' | 'stats';
export type PeriodKey = 'day' | 'month' | 'year' | 'all';

