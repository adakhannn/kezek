/**
 * Core Domain Package
 *
 * Ядро доменной логики (без зависимостей от Next.js и конкретной реализации Supabase).
 *
 * Слои:
 * - booking  — бронирования и промоакции
 * - schedule — расписания и слоты
 * - finance  — финансовые расчёты смен
 * - ports    — интерфейсы репозиториев и внешних сервисов
 */

export * from './booking';
export * from './schedule';
export * from './finance';
export * from './ports';

