-- Database schema for Aura Semijoias CRM

-- Create Enums
CREATE TYPE status_enum AS ENUM ('EM_ESTOQUE', 'BAIXA_NO_ESTOQUE', 'ESGOTADO');
CREATE TYPE forma_pagamento_enum AS ENUM ('PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PARCELADO', 'OUTRO');
CREATE TYPE tipo_movimentacao_enum AS ENUM ('ENTRADA', 'SAIDA');


-- Create table: categorias
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(50) NOT NULL UNIQUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO categorias (nome) VALUES ('ANEL'), ('BRINCO'), ('COLAR'), ('PULSEIRA'), ('CONJUNTO'), ('TORNOZELEIRA')
ON CONFLICT (nome) DO NOTHING;


-- Create table: produtos
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_peca VARCHAR(20),
  referencia VARCHAR(30),
  nome VARCHAR(150),
  categoria VARCHAR(50),
  quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  preco_custo DECIMAL(10,2) NOT NULL DEFAULT 0,
  percentual_lucro DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  valor_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  lucro_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  lucro_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  status status_enum GENERATED ALWAYS AS (
    CASE
      WHEN quantidade = 0 THEN 'ESGOTADO'::status_enum
      WHEN quantidade >= 1 AND quantidade <= 2 THEN 'BAIXA_NO_ESTOQUE'::status_enum
      ELSE 'EM_ESTOQUE'::status_enum
    END
  ) STORED,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create table: clientes
CREATE TABLE clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(100) NOT NULL,
  telefone VARCHAR(20),
  instagram VARCHAR(50),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create table: vendas
CREATE TABLE vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_venda DATE DEFAULT CURRENT_DATE,
  cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
  forma_pagamento forma_pagamento_enum,
  valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  status VARCHAR(20) DEFAULT 'ATIVA' NOT NULL CHECK (status IN ('ATIVA', 'CANCELADA')),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create table: itens_venda
CREATE TABLE itens_venda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id UUID REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_venda DECIMAL(10,2) NOT NULL,
  preco_custo DECIMAL(10,2) NOT NULL,
  lucro DECIMAL(10,2) GENERATED ALWAYS AS (preco_venda - preco_custo) STORED
);


-- Create table: movimentacoes
CREATE TABLE movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE DEFAULT CURRENT_DATE,
  produto_id UUID REFERENCES produtos(id) ON DELETE CASCADE,
  tipo tipo_movimentacao_enum NOT NULL,
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  responsavel VARCHAR(100),
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Create table: logs_acao (auditoria)
CREATE TABLE logs_acao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES perfis(id),
  usuario_email VARCHAR(255),
  acao VARCHAR(50) NOT NULL,
  entidade VARCHAR(50) NOT NULL,
  entidade_id UUID,
  detalhes JSONB,
  criado_em TIMESTAMPTZ DEFAULT now()
);


-- Trigger to update 'atualizado_em' on 'produtos' and 'clientes'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_produtos_updated_at
BEFORE UPDATE ON produtos
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clientes_updated_at
BEFORE UPDATE ON clientes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update stock on sale
CREATE OR REPLACE FUNCTION update_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE produtos
  SET quantidade = quantidade - NEW.quantidade
  WHERE id = NEW.produto_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER subtract_stock_after_sale
AFTER INSERT ON itens_venda
FOR EACH ROW EXECUTE FUNCTION update_stock_on_sale();


-- Update stock on inventory movements
CREATE OR REPLACE FUNCTION process_inventory_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tipo = 'ENTRADA' THEN
    UPDATE produtos SET quantidade = quantidade + NEW.quantidade WHERE id = NEW.produto_id;
  ELSIF NEW.tipo = 'SAIDA' THEN
    UPDATE produtos SET quantidade = quantidade - NEW.quantidade WHERE id = NEW.produto_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER apply_inventory_movement
After INSERT ON movimentacoes
FOR EACH ROW EXECUTE FUNCTION process_inventory_movement();


-- Cancel sale: update status, restore stock, log audit
CREATE OR REPLACE FUNCTION public.cancelar_venda(p_venda_id UUID, p_responsavel VARCHAR, p_motivo TEXT DEFAULT NULL)
RETURNS void
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item RECORD;
  venda_record RECORD;
  total_itens INTEGER;
BEGIN
  IF public.user_perfil() != 'ADMIN' THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar vendas';
  END IF;

  SELECT v.*, c.nome as cliente_nome
  INTO venda_record
  FROM public.vendas v
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE v.id = p_venda_id AND v.status = 'ATIVA';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venda não encontrada ou já cancelada';
  END IF;

  UPDATE public.vendas SET status = 'CANCELADA' WHERE id = p_venda_id;

  SELECT COUNT(*) INTO total_itens FROM public.itens_venda WHERE venda_id = p_venda_id;

  FOR item IN SELECT produto_id, quantidade FROM public.itens_venda WHERE venda_id = p_venda_id LOOP
    INSERT INTO public.movimentacoes (data, produto_id, tipo, quantidade, responsavel, observacoes)
    VALUES (CURRENT_DATE, item.produto_id, 'ENTRADA', item.quantidade, p_responsavel, 'Estorno da venda ' || p_venda_id);
  END LOOP;

  INSERT INTO public.logs_acao (usuario_id, usuario_email, acao, entidade, entidade_id, detalhes)
  VALUES (
    auth.uid(),
    p_responsavel,
    'CANCELAR_VENDA',
    'vendas',
    p_venda_id,
    jsonb_build_object(
      'valor_total', venda_record.valor_total,
      'cliente_nome', venda_record.cliente_nome,
      'motivo', p_motivo,
      'data_venda', venda_record.data_venda,
      'itens_restaurados', total_itens
    )
  );
END;
$$ LANGUAGE plpgsql;


-- Row Level Security + Correções
-- Execute migracao-completa.sql no SQL Editor do Supabase Dashboard para aplicar:
-- 1. DROP EXPRESSION em valor_venda, lucro_unitario, lucro_total (arredondamento manual)
-- 2. SET search_path nas functions (resolve warning do Security Advisor)
-- 3. REVOKE EXECUTE anon (resolve warning anon_security_definer)
-- 4. RLS Policies em todas as tabelas
