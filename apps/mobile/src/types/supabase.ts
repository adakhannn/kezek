// Экспортируем типы из web версии
// В будущем можно синхронизировать через общий файл или скрипт

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Базовые типы - полная версия будет скопирована из apps/web/src/types/supabase.ts
export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: string
          biz_id: string
          branch_id: string
          client_id: string | null
          client_name: string | null
          client_phone: string | null
          created_at: string | null
          start_at: string
          end_at: string
          status: string
          service_id: string
          staff_id: string
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          phone: string | null
          email: string | null
        }
      }
      businesses: {
        Row: {
          id: string
          name: string
          slug: string
        }
      }
    }
  }
}

