-- ============================================
-- Fix Security Advisor alerts — Aura Semijoias
-- Execute TUDO no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new
-- ============================================

-- ============================================
-- PARTE 1: Remover funções órfãs não utilizadas
-- (criadas durante setup inicial, substituídas
--  pelo fluxo do AuthContext na aplicação)
-- ============================================
DROP FUNCTION IF EXISTS public.criar_perfil_ao_signup CASCADE;
DROP FUNCTION IF EXISTS public.atualizar_email_perfil CASCADE;


-- ============================================
-- PARTE 2: Reforçar SET search_path nas funções
-- em uso (resolve function_search_path_mutable)
-- ============================================
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


-- ============================================
-- PARTE 3: Revogar EXECUTE de anon para
-- user_perfil (resolve anon_security_definer)
-- Obs: authenticated precisa manter acesso
-- porque RLS policies chamam user_perfil()
-- ============================================
REVOKE EXECUTE ON FUNCTION public.user_perfil FROM anon, public;


-- ============================================
-- PARTE 4: Ativar Leaked Password Protection
-- (auth_leaked_password_protection)
-- Acesse: Settings > Auth > Security
-- → "Leaked password protection" = ON
-- ============================================
