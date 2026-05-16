-- ============================================
-- RLS Migration — Aura Semijoias CRM
-- Execute no SQL Editor do Supabase Dashboard
-- (abrir: https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new)
-- ============================================

-- 1. Habilitar RLS em todas as tabelas
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- 2. Remover políticas existentes (se houver)
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

-- 3. Criar função auxiliar para verificar perfil do usuário
CREATE OR REPLACE FUNCTION public.user_perfil()
RETURNS TEXT
LANGUAGE SQL STABLE
SECURITY DEFINER
AS $$
  SELECT perfil FROM public.perfis WHERE id = auth.uid()
$$;

-- 4. Políticas para produtos
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

-- 5. Políticas para clientes
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

-- 6. Políticas para vendas
CREATE POLICY "Usuários autenticados podem ver vendas"
  ON vendas FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir vendas"
  ON vendas FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

-- 7. Políticas para itens_venda
CREATE POLICY "Usuários autenticados podem ver itens_venda"
  ON itens_venda FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem inserir itens_venda"
  ON itens_venda FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() IN ('ADMIN', 'USER'));

-- 8. Políticas para movimentacoes
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

-- 9. Políticas para categorias
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

-- 10. Políticas para perfis (acesso restrito)
CREATE POLICY "Usuário pode ver próprio perfil"
  ON perfis FOR SELECT
  USING (auth.uid() = id OR public.user_perfil() = 'ADMIN');

CREATE POLICY "ADMIN pode gerenciar perfis"
  ON perfis FOR ALL
  USING (public.user_perfil() = 'ADMIN')
  WITH CHECK (public.user_perfil() = 'ADMIN');
