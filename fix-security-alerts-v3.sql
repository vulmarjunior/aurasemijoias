-- ============================================
-- Fix Security Advisor v3 — Aura Semijoias
-- USE ALTER FUNCTION (mais confiável que SET na definição)
-- Execute TUDO de uma vez no SQL Editor
-- https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new
-- ============================================

-- ================= ETAPA 1 =================
-- ALTER FUNCTION com SET search_path
-- (resolve function_search_path_mutable)

ALTER FUNCTION public.update_updated_at_column() SET search_path = '';
ALTER FUNCTION public.update_stock_on_sale() SET search_path = '';
ALTER FUNCTION public.process_inventory_movement() SET search_path = '';
ALTER FUNCTION public.user_perfil() SET search_path = '';

-- ================= ETAPA 2 =================
-- Se as funções órfãs ainda existirem, tentar
-- ALTER FUNCTION nelas também (para ao menos
-- resolver o search_path, mesmo que não consiga
-- dar DROP)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'criar_perfil_ao_signup' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.criar_perfil_ao_signup() SET search_path = ''''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'atualizar_email_perfil' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'ALTER FUNCTION public.atualizar_email_perfil() SET search_path = ''''';
  END IF;
END;
$$;

-- ================= ETAPA 3 =================
-- Revogar EXECUTE de anon/public (resolve anon_security_definer)

REVOKE EXECUTE ON FUNCTION public.user_perfil FROM anon, public;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'criar_perfil_ao_signup' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.criar_perfil_ao_signup FROM anon, public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.criar_perfil_ao_signup FROM authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'atualizar_email_perfil' AND pronamespace = 'public'::regnamespace) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.atualizar_email_perfil FROM anon, public';
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.atualizar_email_perfil FROM authenticated';
  END IF;
END;
$$;

-- ================= ETAPA 4 =================
-- Verificar search_path (diagnóstico)

SELECT
  p.proname,
  p.proconfig
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
  AND p.proname IN ('update_updated_at_column', 'update_stock_on_sale',
                    'process_inventory_movement', 'user_perfil',
                    'criar_perfil_ao_signup', 'atualizar_email_perfil')
ORDER BY p.proname;
