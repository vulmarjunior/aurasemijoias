# Dev Log — Aura Semijoias CRM

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: React 19, Vite, Tailwind CSS v4, Supabase e Vercel
> **Última atualização**: 2026-08-27

---

## ✅ O que Funciona

### Inventário

#### Conferência persistente e retomável
- **Status**: ✅ Confirmado
- **Data**: 2026-08-27
- **Contexto**: Implementação de conferência física digital e manual do estoque.
- **Solução**: `inventarios` guarda a sessão e `itens_inventario` preserva o snapshot dos produtos. A RPC `salvar_item_inventario` persiste cada contagem no Supabase, permitindo retomar em outro dispositivo.
- **Observações**: Apenas um inventário pode permanecer `EM_ANDAMENTO`; contagem cega e inclusão de esgotados são configuráveis na abertura.

#### Finalização atômica com auditoria
- **Status**: ✅ Confirmado
- **Data**: 2026-08-27
- **Contexto**: Aplicação segura das divergências encontradas na contagem física.
- **Solução**: `finalizar_inventario` bloqueia sessão, itens e produtos em ordem determinística, recusa snapshots desatualizados e gera `movimentacoes` de `ENTRADA` ou `SAIDA` em vez de editar o estoque diretamente.
- **Observações**: A operação registra `FINALIZAR_INVENTARIO` em `logs_acao`; itens pendentes impedem a finalização.

#### Impressão manual e relatório final
- **Status**: ✅ Confirmado
- **Data**: 2026-08-27
- **Contexto**: Usuários que preferem contar em papel sem perder o fluxo digital.
- **Solução**: A tela `/inventarios` oferece planilha A4 paisagem para contagem manual e relatório de resultado. O CSS de impressão remove a navegação, repete cabeçalhos e preserva linhas de tabela.
- **Observações**: Contagens feitas em papel precisam ser digitadas na sessão antes da finalização para gerar ajustes auditáveis.

#### Helper de uso na própria tela
- **Status**: ✅ Confirmado
- **Data**: 2026-08-27
- **Contexto**: Orientação operacional sem depender de documentação externa.
- **Solução**: O botão `Como usar` abre um guia responsivo com abertura, autosave, revisão, finalização e fluxo de impressão.
- **Observações**: Publicado em produção pelo PR `#3`, merge `244872c`.

### Deploy

#### Integração GitHub e Vercel
- **Status**: ✅ Confirmado
- **Data**: 2026-08-27
- **Contexto**: Publicação da conferência de inventário e do helper.
- **Solução**: PRs `#2` e `#3` foram mesclados na `main`; os checks e deploys da Vercel concluíram com sucesso.
- **Observações**: Rota de produção: `https://aurasemijoias.vercel.app/inventarios`.

---

## ❌ O que Não Funciona

### Ferramentas

#### Supabase CLI não disponível no workspace
- **Status**: ❌ Confirmado que falha
- **Data**: 2026-08-27
- **Contexto**: Tentativa de validar/executar a migration localmente.
- **Problema**: O comando `supabase` não está instalado ou disponível no `PATH`.
- **Alternativa conhecida**: Executar `supabase/migrations/20260827120000_inventory_counts.sql` pelo SQL Editor do Supabase; execução confirmada pelo usuário.

---

## 🔄 Correções de Registro

Nenhuma correção registrada nesta sessão.

---

## 💡 Padrões Descobertos

#### Snapshot antes da contagem
- **Regra**: Uma conferência física deve comparar contra dados copiados no início, nunca contra valores consultados dinamicamente durante a contagem.
- **Aplica-se a**: `inventarios`, `itens_inventario` e relatórios históricos.
- **Exemplo**: Copiar código, referência, nome, categoria e `quantidade_sistema` ao executar `iniciar_inventario`.
- **Fonte**: Revisão de concorrência da implementação de inventário.

#### Ordem única de locks
- **Regra**: RPCs concorrentes do mesmo fluxo devem adquirir locks na mesma ordem: inventário, itens e produtos.
- **Aplica-se a**: Autosave, finalização e futuras operações concorrentes de inventário.
- **Exemplo**: `salvar_item_inventario` bloqueia primeiro a sessão; `finalizar_inventario` bloqueia sessão, itens ordenados e produtos ordenados.
- **Fonte**: Revisão independente identificou risco de deadlock e divergência entre contagem e ajuste.

#### Estoque ajustado somente por movimentações
- **Regra**: Divergências de inventário nunca atualizam `produtos.quantidade` diretamente.
- **Aplica-se a**: Finalização de inventário e qualquer ajuste operacional.
- **Exemplo**: Diferença positiva gera `ENTRADA`; negativa gera `SAIDA`; o trigger atualiza o saldo.
- **Fonte**: Regras de auditoria do projeto.

#### Autosave serializado por item
- **Regra**: Requisições sucessivas do mesmo item devem ser serializadas para uma resposta lenta não sobrescrever uma contagem mais recente.
- **Aplica-se a**: Campos de quantidade física e observação em `Inventarios.tsx`.
- **Exemplo**: Fila de promises por `item.id`, debounce e flush no `blur` ou antes de finalizar/trocar de sessão.
- **Fonte**: Revisão de condições de corrida no frontend.

---

## 📋 Decisões de Arquitetura

#### Inventário como documento auditável
- **Escolha**: Modelar a conferência como sessão persistente com itens em snapshot e status `EM_ANDAMENTO`, `FINALIZADO` ou `CANCELADO`.
- **Alternativas rejeitadas**: Estado apenas no navegador, por limitar retomada entre dispositivos e permitir perda de dados; edição direta de estoque, por eliminar rastreabilidade.
- **Data**: 2026-08-27

#### Bloquear finalização quando o estoque mudar
- **Escolha**: Recusar a finalização se qualquer produto do snapshot mudou ou se um produto fora do snapshot ganhou estoque.
- **Alternativas rejeitadas**: Recalcular silenciosamente contra o estoque atual, pois poderia aplicar uma contagem física feita em outro momento.
- **Data**: 2026-08-27

#### Impressão como extensão da sessão digital
- **Escolha**: Gerar a folha manual a partir do mesmo snapshot e exigir digitação posterior para finalizar.
- **Alternativas rejeitadas**: Relatório avulso sem sessão, pois não permitiria retomada, divergências automáticas nem auditoria.
- **Data**: 2026-08-27

---

## ⚠️ Armadilhas Conhecidas (Gotchas)

- **PWA/Workbox**: Após um deploy, uma instalação aberta pode continuar exibindo o bundle anterior até atualizar ou reiniciar. Use `Ctrl + F5`, feche e reabra a PWA ou limpe o cache quando um novo item de menu não aparecer.
- **Operação durante inventário**: Vendas e movimentações alteram o estoque após o snapshot e bloqueiam a finalização. Evite essas operações até concluir ou cancelar a conferência.
- **Contagem manual**: Imprimir a planilha não salva a quantidade física; os valores precisam ser inseridos na tela antes de finalizar.
- **Branch local `main`**: Pode permanecer atrás de `origin/main` enquanto o trabalho ocorre na branch `agent/atomic-sales-inventory`; use a referência remota ao comparar conteúdo de produção.
