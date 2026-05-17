-- ============================================
-- MIGRAÇÃO COMPLETA — Aura Semijoias CRM
-- Executar TUDO no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new
-- Ordem: (1) schema → (2) functions → (3) RLS → (4) security
-- ============================================

-- ============================================
-- PARTE 1: Corrigir colunas GENERATED para permitir
--          valor_venda editável (arredondamento manual)
-- ============================================
ALTER TABLE produtos
  ALTER COLUMN valor_venda DROP EXPRESSION,
  ALTER COLUMN lucro_unitario DROP EXPRESSION,
  ALTER COLUMN lucro_total DROP EXPRESSION;


-- ============================================
-- PARTE 2: Adicionar SET search_path nas funções
--          (resolve o warning function_search_path_mutable)
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
  UPDATE public.produtos
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
    UPDATE public.produtos SET quantidade = quantidade + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF NEW.tipo = 'SAIDA' THEN
    UPDATE public.produtos SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.produto_id;
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
-- PARTE 3: Revogar EXECUTE de anon nas functions
--          SECURITY DEFINER (resolve o warning
--          anon_security_definer_function_executable)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.atualizar_email_perfil FROM anon;
REVOKE EXECUTE ON FUNCTION public.criar_perfil_ao_signup FROM anon;
REVOKE EXECUTE ON FUNCTION public.user_perfil FROM anon;


-- ============================================
-- PARTE 4: ROW LEVEL SECURITY
-- ============================================

-- 4.1 Habilitar RLS em todas as tabelas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- 4.2 Remover políticas existentes (caso rode novamente)
DROP POLICY IF EXISTS "Usuários autenticados podem ver produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir produtos" ON produtos;
DROP POLICY IF EXISTS "Usuários autenticados podem ver clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem ver vendas" ON vendas;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir vendas" ON vendas;
DROP POLICY IF EXISTS "Usuários autenticados podem ver itens_venda" ON itens_venda;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir itens_venda" ON itens_venda;
DROP POLICY IF EXISTS "Usuários autenticados podem ver movimentacoes" ON movimentacoes;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir movimentacoes" ON movimentacoes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar movimentacoes" ON movimentacoes;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir movimentacoes" ON movimentacoes;
DROP POLICY IF EXISTS "Usuários autenticados podem ver categorias" ON categorias;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir categorias" ON categorias;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar categorias" ON categorias;
DROP POLICY IF EXISTS "Usuários autenticados podem excluir categorias" ON categorias;
DROP POLICY IF EXISTS "Usuários autenticados podem ver perfis" ON perfis;
DROP POLICY IF EXISTS "ADMIN pode gerenciar perfis" ON perfis;
DROP POLICY IF EXISTS "Usuário pode ver próprio perfil" ON perfis;

-- 4.3 Políticas: produtos
CREATE POLICY "Usuários autenticados podem ver produtos"
  ON produtos FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir produtos"
  ON produtos FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem atualizar produtos"
  ON produtos FOR UPDATE
  USING (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem excluir produtos"
  ON produtos FOR DELETE
  USING (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN');

-- 4.4 Políticas: clientes
CREATE POLICY "Usuários autenticados podem ver clientes"
  ON clientes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir clientes"
  ON clientes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem atualizar clientes"
  ON clientes FOR UPDATE
  USING (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem excluir clientes"
  ON clientes FOR DELETE
  USING (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN');

-- 4.5 Políticas: vendas
CREATE POLICY "Usuários autenticados podem ver vendas"
  ON vendas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir vendas"
  ON vendas FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

-- 4.6 Políticas: itens_venda
CREATE POLICY "Usuários autenticados podem ver itens_venda"
  ON itens_venda FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir itens_venda"
  ON itens_venda FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

-- 4.7 Políticas: movimentacoes
CREATE POLICY "Usuários autenticados podem ver movimentacoes"
  ON movimentacoes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir movimentacoes"
  ON movimentacoes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem atualizar movimentacoes"
  ON movimentacoes FOR UPDATE
  USING (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem excluir movimentacoes"
  ON movimentacoes FOR DELETE
  USING (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN');

-- 4.8 Políticas: categorias
CREATE POLICY "Usuários autenticados podem ver categorias"
  ON categorias FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir categorias"
  ON categorias FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem atualizar categorias"
  ON categorias FOR UPDATE
  USING (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

CREATE POLICY "Usuários autenticados podem excluir categorias"
  ON categorias FOR DELETE
  USING (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN');

-- 4.9 Políticas: perfis (acesso restrito)
CREATE POLICY "Usuário pode ver próprio perfil"
  ON perfis FOR SELECT
  USING (auth.uid() = id OR public.user_perfil() = 'ADMIN');

CREATE POLICY "ADMIN pode gerenciar perfis"
  ON perfis FOR ALL
  USING (public.user_perfil() = 'ADMIN')
  WITH CHECK (public.user_perfil() = 'ADMIN');
