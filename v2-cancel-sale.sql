-- ============================================
-- MIGRAÇÃO V2 — Cancelamento de Vendas
-- Executar no SQL Editor do Supabase Dashboard
-- https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc/sql/new
-- ============================================

-- ============================================
-- PARTE 1: Adicionar coluna status em vendas
-- ============================================
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'ATIVA' NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vendas_status_check') THEN
    ALTER TABLE vendas ADD CONSTRAINT vendas_status_check CHECK (status IN ('ATIVA', 'CANCELADA'));
  END IF;
END $$;

UPDATE vendas SET status = 'ATIVA' WHERE status IS NULL;


-- ============================================
-- PARTE 2: Tabela de log de ações (rastreabilidade)
-- ============================================
CREATE TABLE IF NOT EXISTS logs_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES perfis(id),
  usuario_email VARCHAR(255),
  acao VARCHAR(50) NOT NULL,
  entidade VARCHAR(50) NOT NULL,
  entidade_id UUID,
  detalhes JSONB,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- RLS em logs_acao
ALTER TABLE logs_acao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Apenas ADMIN pode ver logs" ON logs_acao;
CREATE POLICY "Apenas ADMIN pode ver logs"
  ON logs_acao FOR SELECT
  USING (public.user_perfil() = 'ADMIN');

-- Apenas a função SECURITY DEFINER insere logs (bypass RLS),
-- então nenhuma política de INSERT/UPDATE/DELETE é necessária.
REVOKE ALL ON logs_acao FROM anon, authenticated;
GRANT SELECT ON logs_acao TO authenticated;


-- ============================================
-- PARTE 3: Política RLS de UPDATE para vendas
--           (apenas ADMIN pode cancelar)
-- ============================================
DROP POLICY IF EXISTS "Apenas ADMIN pode atualizar vendas" ON vendas;
CREATE POLICY "Apenas ADMIN pode atualizar vendas"
  ON vendas FOR UPDATE
  USING (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN')
  WITH CHECK (auth.role() = 'authenticated' AND public.user_perfil() = 'ADMIN');


-- ============================================
-- PARTE 4: Função cancelar_venda
--           - Verifica ADMIN
--           - Atualiza status para CANCELADA
--           - Restaura estoque via movimentacoes (ENTRADA)
--           - Registra log de auditoria
--           Tudo em uma transação
-- ============================================
CREATE OR REPLACE FUNCTION public.cancelar_venda(venda_id UUID, responsavel VARCHAR, motivo TEXT DEFAULT NULL)
RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item RECORD;
  venda_record RECORD;
  total_itens INTEGER;
BEGIN
  -- Apenas ADMIN pode cancelar
  IF public.user_perfil() != 'ADMIN' THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar vendas';
  END IF;

  -- Verificar se a venda existe e está ATIVA
  SELECT v.*, c.nome as cliente_nome
  INTO venda_record
  FROM public.vendas v
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE v.id = venda_id AND v.status = 'ATIVA';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada ou já cancelada';
  END IF;

  -- Atualizar status
  UPDATE public.vendas SET status = 'CANCELADA' WHERE id = venda_id;

  -- Restaurar estoque via movimentacoes (ENTRADA) para cada item
  SELECT COUNT(*) INTO total_itens FROM public.itens_venda WHERE venda_id = venda_id;

  FOR item IN SELECT produto_id, quantidade FROM public.itens_venda WHERE venda_id = venda_id LOOP
    INSERT INTO public.movimentacoes (data, produto_id, tipo, quantidade, responsavel, observacoes)
    VALUES (CURRENT_DATE, item.produto_id, 'ENTRADA', item.quantidade, responsavel, 'Estorno da venda ' || venda_id);
  END LOOP;

  -- Registrar log de auditoria
  INSERT INTO public.logs_acao (usuario_id, usuario_email, acao, entidade, entidade_id, detalhes)
  VALUES (
    auth.uid(),
    responsavel,
    'CANCELAR_VENDA',
    'vendas',
    venda_id,
    jsonb_build_object(
      'valor_total', venda_record.valor_total,
      'cliente_nome', venda_record.cliente_nome,
      'motivo', motivo,
      'data_venda', venda_record.data_venda,
      'itens_restaurados', total_itens
    )
  );
END;
$$ LANGUAGE plpgsql;
