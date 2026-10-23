# Master Plan — Aura Semijoias

## Missão

CRM da Aura Semijoias: controle de produtos, clientes, vendas e movimentações
de estoque.

## Estado atual

- Ciclo de vida: produção
- Publicação: Vercel, `https://aurasemijoias.vercel.app`
- Banco: PostgreSQL (Supabase, Auth e RLS)
- Homologação: não registrada nesta pauta
- Verificado em: 2026-10-23

## Princípios e limites

- Dados de clientes, vendas e estoque são sensíveis; não expor em logs ou
  memória.
- Vendas e movimentações usam as RPCs transacionais; não inserir venda e itens
  separadamente pelo frontend.
- `SUPABASE_SERVICE_KEY` nunca vai ao navegador.
- Não duplicar arquitetura: `CONTEXT.md`, `Especificacao_Tecnica.md` e
  `dev-log.md` são as fontes.
- Alterações de produção exigem autorização específica.

## Próximo passo

Definir a próxima pauta com o responsável; não há pendência registrada.
