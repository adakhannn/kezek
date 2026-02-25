/**
 * Core Domain Package
 *
 * Ядро доменной логики (без зависимостей от Next.js и конкретной реализации Supabase).
 *
 * Слои:
 * - booking — доменная логика бронирований и промоакций
 * - schedule — доменная логика расписаний и слотов
 * - ports — интерфейсы репозиториев и внешних сервисов
 */

export * from './booking';
export * from './schedule';
export * from './ports';

