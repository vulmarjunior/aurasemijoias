-- ============================================
-- Fix Security Advisor v2 — Aura Semijoias
-- Execute CADA ETAPA separadamente no SQL Editor
-- https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new
-- Verifique se cada etapa retorna "Success. No rows returned"
-- ANTES de passar para a próxima.
-- ============================================

-- ================= ETAPA 1 =================
-- Verificar funções existentes (diagnóstico)
SELECT proname, prosrc, proargnames
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('criar_perfil_ao_signup', 'atualizar_email_perfil',
                  'update_updated_at_column', 'update_stock_on_sale',
                  'process_inventory_movement', 'user_perfil')
ORDER BY proname;

-- ================= ETAPA 2 =================
-- Tentar DROP das funções órfãs
-- Se falhar, pule para Etapa 3
DROP FUNCTION IF EXISTS public.criar_perfil_ao_signup CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_email_perfil CASCADE;

-- ================= ETAPA 3 =================
-- Atualizar funções com SET search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  UPDATE produtos
  SET quantidade = quantidade - NEW.quantidade
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.process_inventory_movement()
RETURNS TRIGGER
SET search_path = ''
AS $$
BEGIN
  IF NEW.tipo = 'ENTRADA' THEN
    UPDATE produtos SET quantidade = quantidade + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF NEW.tipo = 'SAIDA' THEN
    UPDATE produtos SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.produto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.user_perfil()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT perfil FROM public.perfis WHERE id = auth.uid()
$$;

-- ================= ETAPA 4 =================
-- Revogar EXECUTE de anon/public para user_perfil
REVOKE EXECUTE ON FUNCTION public.user_perfil FROM anon, public;

-- ================= ETAPA 5 =================
-- Caso a Etapa 2 tenha falhado, tentar
-- REVOKE nas funções órfãs (se ainda existirem)
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

-- ================= ETAPA 6 =================
-- Verificar search_path das funções
SELECT
  proname,
  pg_catalog.pg_get_function_arg_default(oid, 0) as search_path
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('update_updated_at_column', 'update_stock_on_sale',
                  'process_inventory_movement', 'user_perfil');
