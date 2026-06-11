# Plano: Controle de Consignações

> Criado em: 11/06/2026

---

## Problema

Algumas peças do estoque são consignadas para venda. Quando o prazo de consignação termina sem venda, é preciso dar baixa no estoque. Atualmente a tela **Movimentações** permite registrar `SAIDA` manual, mas não há rastreamento de prazos, responsáveis, nem alertas de vencimento.

---

## Solução Proposta

Nova funcionalidade dedicada de **Consignações**, com tabela própria, página CRUD, integração com o sistema de movimentações existente e alertas no Dashboard.

---

## 1. Banco de Dados

### Nova tabela `consignacoes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID PK | |
| `produto_id` | UUID FK → produtos.id (RESTRICT) | Peça consignada |
| `quantidade` | INTEGER CHECK (> 0) | |
| `responsavel_nome` | VARCHAR(100) | Nome de quem pegou |
| `responsavel_contato` | VARCHAR(100) | Telefone ou Instagram |
| `data_saida` | DATE | Data que saiu |
| `data_prevista_devolucao` | DATE | Prazo |
| `data_devolucao_real` | DATE | NULL se ainda ativa |
| `status` | VARCHAR(20) DEFAULT 'ATIVA' CHECK (ATIVA, DEVOLVIDA, PERDIDA) | |
| `observacoes` | TEXT | |
| `criado_em` | TIMESTAMP | |
| `atualizado_em` | TIMESTAMP | |

### Trigger (opcional)

- Ao criar consignação com status `ATIVA` → inserir movimento `SAIDA` em `movimentacoes` (reusa trigger `process_inventory_movement` para ajustar estoque).
- Ao devolver (`DEVOLVIDA`) → inserir movimento `ENTRADA` em `movimentacoes`.

### Migration SQL

Emitir `CREATE TABLE consignacoes`, trigger function, RLS policies, e INSERT/DELETE na tabela `movimentacoes` automaticamente.

---

## 2. Página `/consignacoes` (nova)

### Funcionalidades

- **Listagem** com filtros: status (ATIVA | DEVOLVIDA | PERDIDA), busca por nome do produto ou responsável
- **Registrar consignação**: modal com autocomplete de produto, quantidade, nome do responsável, contato, data prevista de devolução
- **Devolver**: botão na linha → modal confirmando devolução → estoque restaurado automaticamente
- **Marcar como Perdida**: confirmação → baixa definitiva (estoque não restaura)
- **Consignações vencidas**: destacadas em vermelho (data prevista < hoje e status ATIVA)

### Tabela de colunas na listagem

| Produto | Código | Qtd | Responsável | Contato | Saída | Previsão | Devolução | Status | Ações |
|---------|--------|-----|-------------|---------|-------|----------|-----------|--------|-------|

### Cores de status

- ATIVA → azul (`bg-blue-100 text-blue-800`)
- DEVOLVIDA → verde (`bg-green-100 text-green-800`)
- PERDIDA → vermelho (`bg-red-100 text-red-800`)

### Ações por linha

| Status | Ações disponíveis |
|--------|-------------------|
| ATIVA | Devolver, Marcar como Perdida |
| DEVOLVIDA | (somente visualização) |
| PERDIDA | (somente visualização) |

---

## 3. Integração com Movimentações

- `SAIDA` é gerada automaticamente ao criar consignação (estoque diminui).
- `ENTRADA` é gerada automaticamente ao devolver (estoque aumenta).
- Perda **não** gera movimentação (produto simplesmente sai do estoque sem retorno).
- A tela Movimentações existente continuará exibindo todos os movimentos normalmente.

---

## 4. Dashboard

Adicionar ao `Dashboard.tsx`:

- **Card novo**: "Consignações Ativas" — exibe `SELECT SUM(quantidade) FROM consignacoes WHERE status = 'ATIVA'`
- **Alerta**: abaixo dos alertas de estoque, listar consignações com prazo vencido nos próximos 7 dias

---

## 5. Permissões

| Role | Permissão |
|------|-----------|
| ADMIN | CRUD total |
| USER | CRUD (inserir, editar, devolver, marcar perda) |
| VIEWER | Leitura apenas |

(mesmo padrão das demais telas)

---

## 6. RLS

Políticas `consignacoes`:

- `SELECT`: authenticated
- `INSERT`: authenticated + canEdit(perfil)
- `UPDATE`: authenticated + canEdit(perfil)
- `DELETE`: authenticated + canDelete(perfil) → apenas ADMIN

---

## 7. Dependências

- Nenhuma externa nova.
- Reuso dos componentes existentes: `Modal`, `AutoComplete` (produtos), badges de status, formatação de data.

---

## 8. Arquivos a modificar/criar

| Ação | Arquivo |
|------|---------|
| Criar | `database/consignacoes.sql` (migration) |
| Criar | `src/pages/Consignacoes.tsx` |
| Modificar | `src/App.tsx` (nova rota) |
| Modificar | `src/pages/Dashboard.tsx` (novo card + alertas) |
| Modificar | `src/components/Layout.tsx` (novo link na sidebar) |
| Modificar | `CONTEXT.md` (documentação) |

---

## 9. Critérios de aceite (UAT)

1. Consignação criada reduz estoque do produto automaticamente.
2. Consignação devolvida restaura estoque automaticamente.
3. Consignação vencida aparece destacada em vermelho.
4. Card "Consignações Ativas" no Dashboard reflete o total correto.
5. Usuário VIEWER não consegue criar/editar/deletar.
6. Apenas ADMIN pode deletar consignações.
7. Tabela `consignacoes` possui RLS funcional.
