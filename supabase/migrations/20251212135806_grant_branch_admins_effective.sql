-- Даём права на выполнение функции для анонимного и аутентифицированного пользователей
GRANT EXECUTE ON FUNCTION public.branch_admins_effective(uuid) TO anon, authenticated;

