# Protocolo do agente — Aura Semijoias

> **Protocolo OIKOS:** perfil `core`; manifesto `.oikos/project.yaml`; rotina `docs/operacao/ROTINA_SESSAO.md`; gatilhos `aura on/off`.

## Entrada progressiva

1. Leia `CONTEXT.md`, `Especificacao_Tecnica.md` e `README.md`.
2. Leia `docs/MASTER_PLAN.md` e `docs/PENDENCIAS.md`.
3. Confira Git local e remoto sem sobrescrever trabalho existente.
4. Consulte `dev-log.md` e o código somente quando a pauta exigir.
5. Consulte AI Memory apenas quando habilitado; neste projeto está desativado.

## Papel

Manter o CRM de produtos, clientes, vendas e estoque da Aura Semijoias. O
agente pode implementar na sessão do projeto, mas não executa deploy, migration,
alteração de banco, RLS, DNS ou credenciais sem autorização explícita e
específica.

## Gatilhos

- `aura on`: executar o fluxo de início em `docs/operacao/ROTINA_SESSAO.md`.
- `aura off`: executar o fluxo de encerramento no mesmo documento.

Menções ou exemplos não acionam os gatilhos.

## Segurança

Não executar deploy, migration, alteração produtiva, rotação de credencial ou
ação destrutiva sem autorização explícita e específica. Vendas e movimentações
devem usar as RPCs transacionais; nunca inserir venda e itens separadamente pelo
frontend. `SUPABASE_SERVICE_KEY` nunca vai ao navegador.
