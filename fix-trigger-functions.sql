-- Fix trigger functions: qualify produtos with public. prefix
-- (SET search_path = '' breaks unqualified references)

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
