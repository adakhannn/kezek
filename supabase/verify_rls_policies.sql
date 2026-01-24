-- Скрипт для проверки, что все RLS политики созданы успешно
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- Проверяем политики для businesses
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'businesses'
ORDER BY policyname;

-- Проверяем политики для branches
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'branches'
ORDER BY policyname;

-- Проверяем политики для staff
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'staff'
ORDER BY policyname;

-- Проверяем политики для services
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'services'
ORDER BY policyname;

-- Проверяем политики для bookings
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'bookings'
ORDER BY policyname;

-- Проверяем политики для service_staff
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'service_staff'
ORDER BY policyname;

-- Проверяем, включен ли RLS для всех таблиц
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('businesses', 'branches', 'staff', 'services', 'bookings', 'service_staff')
ORDER BY tablename;

