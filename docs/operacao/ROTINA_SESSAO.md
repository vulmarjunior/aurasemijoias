# Rotina de sessão — AURA ON / OFF

## `aura on`

1. Ler `AGENTS.md`, `CONTEXT.md`, `Especificacao_Tecnica.md`,
   `docs/MASTER_PLAN.md` e `docs/PENDENCIAS.md`.
2. Conferir raiz, branch, alterações locais e upstream.
3. Sincronizar somente com upstream definido, árvore limpa e fast-forward
   possível. Nunca usar stash, reset, rebase, descarte, commit ou push por este
   gatilho.
4. Consultar AI Memory somente quando habilitado; neste projeto está desativado.
5. Informar Git, pauta, contexto, bloqueios e próximo passo. Não implementar
   apenas pelo gatilho.

## `aura off`

1. Revisar apenas o trabalho efetivamente realizado e as validações executadas.
2. Atualizar cada fato em sua fonte: `docs/MASTER_PLAN.md`,
   `docs/PENDENCIAS.md` e `dev-log.md`, sem duplicação.
3. Não criar release, alterar versão ou duplicar registro por mero encerramento.
4. Conferir diff e Git sem commit, push ou deploy automáticos.
5. Informar concluído, pendente, validações, arquivos alterados, estado do Git e
   próxima ação.
