# Dev Log — Aura Semijoias CRM

> Documentação viva de descobertas técnicas. Atualizada automaticamente durante o desenvolvimento.
> **Stack**: React 19, Vite, Tailwind CSS v4, Supabase e Vercel
> **Última atualização**: 2026-10-08

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

### Movimentações

#### Saída em lote atômica
- **Status**: ✅ Confirmado
- **Data**: 2026-09-16
- **Contexto**: Dar baixa em vários produtos exigia um lançamento por vez na tela `/movimentacoes`.
- **Solução**: A RPC `registrar_movimentacoes_lote` valida o estoque de todos os itens, adquire locks na ordem de `produto.id` e insere uma movimentação por produto na mesma transação; o modal `Saída em Lote` adiciona itens por busca com estoque visível e quantidade editável.
- **Observações**: Falha em qualquer item cancela o lote inteiro; o saldo continua sendo atualizado apenas pelo gatilho `process_inventory_movement`.

### Etiquetas

#### Impressão em lote de etiquetas PIMACO A4251
- **Status**: ✅ Confirmado
- **Data**: 2026-10-08
- **Contexto**: O usuário redigitava produto por produto no editor da Pimaco para imprimir etiquetas de código e preço.
- **Solução**: A tela `/etiquetas` seleciona produtos em lote (busca, categoria e disponibilidade), monta as folhas A4251 (65 etiquetas de 38,2 × 21,2 mm em 5 colunas × 13 linhas) e imprime via `window.print()` com `codigo_peca` (fallback `referencia`) e preço de venda. Inclui posição inicial da folha e ajuste fino horizontal/vertical em mm.
- **Observações**: A folha é renderizada com `createPortal` em `document.body` e `#root { display:none }` no `@media print`, com `@page` A4 retrato injetado pela própria página.

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

#### Geometria oficial PIMACO A4251
- **Regra**: Folha A4 retrato; margem superior 10,7 mm; margem esquerda 4,5 mm; etiqueta 38,2 × 21,2 mm; passo horizontal 40,7 mm (gap de 2,5 mm); passo vertical 21,2 mm (linhas encostadas); 5 colunas × 13 linhas = 65 etiquetas.
- **Aplica-se a**: `src/pages/Etiquetas.tsx` e CSS de impressão em `src/index.css`.
- **Exemplo**: Posição `left = 4.5 + coluna * 40.7`, `top = 10.7 + linha * 21.2`.
- **Fonte**: Parâmetros oficiais de impressão Pimaco para folhas A4.

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

#### Impressão de etiquetas via portal no body
- **Escolha**: Renderizar a folha A4251 com `createPortal` em `document.body`, ocultar `#root` no `@media print` e injetar `@page` A4 retrato a partir da própria página de Etiquetas.
- **Alternativas rejeitadas**: `visibility:hidden` como no inventário, por não garantir fatiamento correto em várias folhas; `@page` estático no CSS, por conflitar com o `@page` A4 landscape do inventário.
- **Data**: 2026-10-08

---

## ⚠️ Armadilhas Conhecidas (Gotchas)

- **PWA/Workbox**: Após um deploy, uma instalação aberta pode continuar exibindo o bundle anterior até atualizar ou reiniciar. Use `Ctrl + F5`, feche e reabra a PWA ou limpe o cache quando um novo item de menu não aparecer.
- **Operação durante inventário**: Vendas e movimentações alteram o estoque após o snapshot e bloqueiam a finalização. Evite essas operações até concluir ou cancelar a conferência.
- **Contagem manual**: Imprimir a planilha não salva a quantidade física; os valores precisam ser inseridos na tela antes de finalizar.
- **Branch local `main`**: Pode permanecer atrás de `origin/main` enquanto o trabalho ocorre na branch `agent/atomic-sales-inventory`; use a referência remota ao comparar conteúdo de produção.
- **Impressão de etiquetas**: A janela de impressão deve estar em A4, escala 100% (tamanho real), margens padrão e sem cabeçalhos/rodapés; qualquer escala diferente desalinha a folha Pimaco.
- **Status `EM_ESTOQUE` (R1)**: Só existe com quantidade ≥ 3. Como a loja trabalha com peças únicas, o catálogo real fica praticamente todo em `ESGOTADO`/`BAIXA_NO_ESTOQUE` (dados de 2026-10-08: 411 esgotados, 35 baixa, 0 em estoque). Filtros de disponibilidade no app devem usar `quantidade > 0`, nunca o status `EM_ESTOQUE`.
