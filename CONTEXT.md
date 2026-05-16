# CONTEXT.md — CRM AURA SEMIJOIAS
> Leia este arquivo antes de gerar qualquer código neste projeto.

---

## Sobre o projeto

CRM para controle de vendas de semijoias da loja **AURA SEMIJOIAS**.  
Stack: **React + Tailwind CSS** (frontend) + **Supabase** (banco PostgreSQL + API + Auth).  
Deploy: Vercel (frontend + serverless functions) + Supabase (backend).  
PWA: Service worker com Workbox, manifesto com `lang: pt-BR`, ícones 192x192 e 512x512, navegação offline.  
API: `api/create-user.js` — Vercel Serverless Function para criação de usuários com `supabase.auth.admin.createUser()`.

---

## Banco de dados — 5 tabelas

### produtos
id              UUID PRIMARY KEY
codigo_peca     VARCHAR(20)
referencia      VARCHAR(30)
nome            VARCHAR(150)
categoria       ENUM: ANEL | BRINCO | COLAR | PULSEIRA | CONJUNTO | TORNOZELEIRA
quantidade      INTEGER  (nunca negativo)
preco_custo     DECIMAL(10,2)
percentual_lucro DECIMAL(5,2)  (padrão: 1.00 = 100% de markup)
valor_venda     DECIMAL(10,2)  (= preco_custo × (1 + percentual_lucro))
lucro_unitario  DECIMAL(10,2)
lucro_total     DECIMAL(10,2)
status          ENUM: EM_ESTOQUE | BAIXA_NO_ESTOQUE | ESGOTADO  (calculado, não editável)
criado_em       TIMESTAMP
atualizado_em   TIMESTAMP

### clientes
id              UUID PRIMARY KEY
nome            VARCHAR(100)
telefone        VARCHAR(20)
instagram       VARCHAR(50)
observacoes     TEXT
criado_em       TIMESTAMP
atualizado_em   TIMESTAMP

### vendas
id              UUID PRIMARY KEY
data_venda      DATE
cliente_id      FK → clientes.id
forma_pagamento ENUM: PIX | DINHEIRO | CARTAO_CREDITO | CARTAO_DEBITO | PARCELADO | OUTRO
valor_total     DECIMAL(10,2)
observacoes     TEXT
criado_em       TIMESTAMP

### itens_venda
id              UUID PRIMARY KEY
venda_id        FK → vendas.id
produto_id      FK → produtos.id
quantidade      INTEGER
preco_venda     DECIMAL(10,2)  ← snapshot do preço no momento da venda
preco_custo     DECIMAL(10,2)  ← snapshot do custo no momento da venda
lucro           DECIMAL(10,2)  (= preco_venda - preco_custo)

### movimentacoes
id              UUID PRIMARY KEY
data            DATE
produto_id      FK → produtos.id
tipo            ENUM: ENTRADA | SAIDA
quantidade      INTEGER
responsavel     VARCHAR(100)
observacoes     TEXT
criado_em       TIMESTAMP

---

## Regras de negócio — SEMPRE respeitar

**R1 — Status calculado automaticamente:**
- quantidade = 0 → ESGOTADO
- quantidade 1 ou 2 → BAIXA_NO_ESTOQUE
- quantidade ≥ 3 → EM_ESTOQUE
- Nunca exibir "status" como campo editável em formulários.

**R2 — Valor de venda calculado:**
- valor_venda = preco_custo × (1 + percentual_lucro)
- Calcular automaticamente quando preco_custo ou percentual_lucro mudar.

**R3 — Estoque reduz ao vender:**
- Ao registrar uma venda, subtrair a quantidade vendida de produtos.quantidade para cada item.
- Nunca permitir venda de produto com quantidade = 0.

**R4 — Movimentações alteram estoque:**
- ENTRADA: soma à quantidade do produto.
- SAIDA: subtrai da quantidade. Bloquear se resultado for negativo.

**R5 — Snapshot de preço em itens_venda:**
- Sempre copiar preco_venda e preco_custo do produto no momento da venda.
- Nunca referenciar o preço atual do produto para calcular lucro histórico.

---

## Telas do sistema

| Tela           | Descrição resumida                                                  |
|----------------|---------------------------------------------------------------------|
| Dashboard      | Cards com totais, alertas de estoque crítico, últimas vendas        |
| Estoque        | Listagem com filtro por categoria/status, busca, cadastro/edição    |
| Clientes       | Listagem, cadastro/edição, histórico de compras do cliente          |
| Vendas         | Registrar venda (cliente + produtos + qtd), listagem com filtros    |
| Movimentações  | Registrar entrada/saída de estoque, histórico por produto           |
| Relatórios     | Faturamento por período, lucro por categoria, produtos mais vendidos|

---

## Cores de status (usar sempre)
- EM_ESTOQUE → verde (bg-green-100 text-green-800)
- BAIXA_NO_ESTOQUE → amarelo (bg-yellow-100 text-yellow-800)
- ESGOTADO → vermelho (bg-red-100 text-red-800)

---

## Padrão de acesso ao Supabase (usar em todos os componentes)
```javascript
import { supabase } from '../lib/supabase'

// Buscar
const { data, error } = await supabase.from('produtos').select('*')

// Inserir
const { error } = await supabase.from('produtos').insert({ ... })

// Atualizar
const { error } = await supabase.from('produtos').update({ ... }).eq('id', id)

// Deletar
const { error } = await supabase.from('produtos').delete().eq('id', id)
```
