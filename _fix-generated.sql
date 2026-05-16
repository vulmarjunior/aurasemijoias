-- ============================================
-- Remover GENERATED ALWAYS de valor_venda,
-- lucro_unitario e lucro_total em produtos
-- para permitir arredondamento manual.
-- Manter status como GENERATED (calculado).
-- ============================================
ALTER TABLE produtos
  ALTER COLUMN valor_venda DROP EXPRESSION,
  ALTER COLUMN lucro_unitario DROP EXPRESSION,
  ALTER COLUMN lucro_total DROP EXPRESSION;
