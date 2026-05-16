# CONTEXT.md — CRM AURA SEMIJOIAS
> Leia este arquivo antes de gerar qualquer código neste projeto.

---

## Sobre o projeto

CRM para controle de vendas de semijoias da loja **AURA SEMIJOIAS**.  
Stack: **React 19 + Vite + Tailwind CSS v4** (frontend) + **Supabase** (PostgreSQL + Auth + RLS).  
Deploy: Vercel (frontend + serverless functions) + Supabase (backend).  
PWA: Service worker com Workbox, manifesto `lang: pt-BR`, display standalone, ícones 192x192 e 512x512.  
API: `api/create-user.js` — Vercel Serverless Function para criação de usuários com `supabase.auth.admin.createUser()`.

---

## Banco de dados — 7 tabelas

### perfis
id UUID PK → auth.users.id
nome VARCHAR(100)
email VARCHAR(255)
perfil VARCHAR(10) CHECK: ADMIN | USER | VIEWER
ativo BOOLEAN default true
criado_em TIMESTAMP

### categorias
id UUID PK
nome VARCHAR(50) UNIQUE
criado_em, atualizado_em TIMESTAMP

### produtos
id              UUID PK
codigo_peca     VARCHAR(20)
referencia      VARCHAR(30)
nome            VARCHAR(150)
categoria       VARCHAR(50)  (FK lógica → categorias.nome, sem constraint)
quantidade      INTEGER CHECK (>= 0)
preco_custo     DECIMAL(10,2)
percentual_lucro DECIMAL(5,2) default 1.00
valor_venda     DECIMAL(10,2) (GENERATED → coluna regular via DROP EXPRESSION)
lucro_unitario  DECIMAL(10,2) (GENERATED → coluna regular via DROP EXPRESSION)
lucro_total     DECIMAL(10,2) (GENERATED → coluna regular via DROP EXPRESSION)
status          status_enum GENERATED ALWAYS (ESGOTADO | BAIXA_NO_ESTOQUE | EM_ESTOQUE)
criado_em, atualizado_em TIMESTAMP

### clientes
id UUID PK
nome VARCHAR(100)
telefone VARCHAR(20)
instagram VARCHAR(50)
observacoes TEXT
criado_em, atualizado_em TIMESTAMP

### vendas
id UUID PK
data_venda DATE
cliente_id FK → clientes.id
forma_pagamento forma_pagamento_enum
valor_total DECIMAL(10,2)
observacoes TEXT (desconto prefixado como DESC:val|)
criado_em TIMESTAMP

### itens_venda
id UUID PK
venda_id FK → vendas.id CASCADE
produto_id FK → produtos.id RESTRICT
quantidade INTEGER CHECK (> 0)
preco_venda DECIMAL(10,2) (snapshot)
preco_custo DECIMAL(10,2) (snapshot)
lucro DECIMAL(10,2) GENERATED ALWAYS AS (preco_venda - preco_custo)

### movimentacoes
id UUID PK
data DATE
produto_id FK → produtos.id CASCADE
tipo tipo_movimentacao_enum
quantidade INTEGER CHECK (> 0)
responsavel VARCHAR(100)
observacoes TEXT
criado_em TIMESTAMP

---

## Regras de negócio — SEMPRE respeitar

**R1 — Status calculado automaticamente (GENERATED ALWAYS):**
- quantidade = 0 → ESGOTADO
- quantidade 1 ou 2 → BAIXA_NO_ESTOQUE
- quantidade ≥ 3 → EM_ESTOQUE
- Campo de leitura apenas. Não editar em formulários.

**R2 — Valor de venda calculado (e arredondável manualmente):**
- `valor_venda = preco_custo × (1 + percentual_lucro)`
- Colunas `valor_venda`, `lucro_unitario`, `lucro_total` tiveram `GENERATED ALWAYS` removido (DROP EXPRESSION) para permitir arredondamento manual.
- App recalcula `percentual_lucro` quando `valor_venda` é editado.

**R3 — Estoque reduz ao vender:**
- Acionado por trigger `update_stock_on_sale` após INSERT em `itens_venda`.
- Nunca permitir venda de produto com quantidade = 0.

**R4 — Movimentações alteram estoque:**
- Acionado por trigger `process_inventory_movement` após INSERT em `movimentacoes`.
- ENTRADA: soma. SAIDA: subtrai. Bloquear se resultado negativo.

**R5 — Snapshot de preço em itens_venda:**
- Copiar `preco_venda` e `preco_custo` do produto no momento da venda.
- Nunca referenciar o preço atual para calcular lucro histórico.

---

## Telas do sistema

| Rota             | Tela              | Descrição                                             |
|------------------|-------------------|-------------------------------------------------------|
| `/`              | Dashboard         | KPIs, gráfico faturamento 6 meses, alertas estoque    |
| `/produtos`      | Estoque           | CRUD, filtros por categoria/status, busca             |
| `/clientes`      | Clientes          | CRUD, busca, máscara telefone, link WhatsApp          |
| `/vendas`        | Vendas            | Registrar venda (autocomplete produto, desconto %/R$), listagem |
| `/movimentacoes` | Movimentações     | Registrar entrada/saída, listagem por produto         |
| `/configuracoes` | Configurações     | Perfil, alterar senha, gerenciar usuários (admin), categorias |
| `/importar`      | Importar Planilha | Drag-and-drop Excel para importar dados legado        |
| (login)          | Login             | Email + senha, sem signup público                     |
| (offline)        | Offline           | Página exibida quando sem conexão                     |

---

## Cores e identidade visual

### Paleta brand (dourado envelhecido / primary accent)
```css
--color-brand-50: #fffbeb;
--color-brand-100: #fef3c7;
--color-brand-200: #fde68a;
--color-brand-400: #fbbf24;
--color-brand-500: #f59e0b;
--color-brand-600: #d97706;
--color-brand-700: #b45309;
--color-brand-800: #92400e;
--color-brand-900: #78350f;
```
Definida via `@theme` em `src/index.css`. Usar classes `bg-brand-*`, `text-brand-*`, `border-brand-*`.

### Neutros
- Unificar com `stone` (ex `slate` substituído globalmente por `stone`).
- Ex: `text-stone-500`, `border-stone-200`, `bg-stone-50`.

### Cores de status (produtos)
- EM_ESTOQUE → verde (`bg-green-100 text-green-800`)
- BAIXA_NO_ESTOQUE → amarelo (`bg-yellow-100 text-yellow-800`)
- ESGOTADO → vermelho (`bg-red-100 text-red-800`)

### Sidebar "fio de ouro"
- Item ativo: fundo `bg-brand-50`, borda `brand-200`, barra gradiente vertical à esquerda (`from-brand-400 to-brand-600`).

---

## Padrão de acesso ao Supabase
```javascript
import { supabase } from '../lib/supabase'

const { data, error } = await supabase.from('produtos').select('*')
const { error } = await supabase.from('produtos').insert({ ... })
const { error } = await supabase.from('produtos').update({ ... }).eq('id', id)
const { error } = await supabase.from('produtos').delete().eq('id', id)
```

---

## Autenticação e permissões

### Fluxo
1. `Supabase.auth.signInWithPassword()` no Login.
2. `AuthContext` busca perfil na tabela `perfis`.
3. Se perfil não existir (primeiro login), auto-cria como `USER`.
4. Criação de usuários: apenas ADMIN via `api/create-user.js` (Vercel Serverless Function).
5. Signup público desabilitado (`disable_signup=true` no Supabase Auth).

### Roles
- **ADMIN**: CRUD total + gerenciar usuários.
- **USER**: CRUD (sem gerenciamento de usuários).
- **VIEWER**: Leitura apenas.

### Helpers (`src/lib/permissions.ts`)
```typescript
canEdit(perfil)   // ADMIN | USER
canDelete(perfil)  // ADMIN
canManageUsers(perfil) // ADMIN
```

---

## RLS (Row Level Security)

- Aplicadas a todas as 7 tabelas.
- `user_perfil()` function com `SECURITY DEFINER` e `SET search_path = ''`.
- Políticas: SELECT para `authenticated`; INSERT/UPDATE para ADMIN/USER; DELETE para ADMIN.
- Perfis: usuário vê próprio, ADMIN vê todos. Gerenciamento apenas ADMIN.

---

## Segurança — Supabase Security Advisor

### Resolvidos (aplicados via `fix-security-alerts-v3.sql`)
| Alerta | Qtde | Solução |
|--------|------|---------|
| `function_search_path_mutable` | 6 funções | `ALTER FUNCTION ... SET search_path = ''` |
| `anon_security_definer_function_executable` | 3 funções | DROP das funções órfãs + REVOKE EXECUTE de `user_perfil` para anon/public |
| `authenticated_security_definer_function_executable` | 2 funções órfãs | DROP (`criar_perfil_ao_signup`, `atualizar_email_perfil`) |

### Aceitáveis (não resolvidos)
| Alerta | Motivo |
|--------|--------|
| `authenticated_security_definer_function_executable` (`user_perfil`) | Necessário para RLS. `SECURITY DEFINER` com `SET search_path = ''` mitiga risco. |
| `auth_leaked_password_protection` | Disponível apenas no Pro Plan (pago). Ignorar no Free Tier. |

### Funções órfãs eliminadas
- `public.criar_perfil_ao_signup` — trigger removido de `auth.users` (causava 500).
- `public.atualizar_email_perfil` — substituído pelo fluxo do AuthContext.

### Triggers em operação
- `update_produtos_updated_at` / `update_clientes_updated_at` → `update_updated_at_column()`
- `subtract_stock_after_sale` → `update_stock_on_sale()`
- `apply_inventory_movement` → `process_inventory_movement()`

---

## Migration files (ordem de execução)
1. `database.sql` — Schema completo (enum, tabelas, triggers, funções).
2. `rls-migration.sql` — RLS policies iniciais.
3. `migracao-completa.sql` — DROP EXPRESSION + SET search_path + REVOKE anon + RLS.
4. `fix-security-alerts-v2.sql` — DROP funções órfãs + CREATE OR REPLACE com SET search_path.
5. `fix-security-alerts-v3.sql` — ALTER FUNCTION SET search_path + REVOKE definitivo.

---

## Funcionalidades implementadas

- CRUD completo: Produtos, Clientes, Vendas, Movimentações, Categorias.
- Dashboard com KPIs, gráfico de faturamento (Recharts), alertas de estoque.
- Vendas: autocomplete de produtos, desconto % ou R$, cadastro rápido de clientes.
- Importação de Excel legado (4 planilhas, 95 produtos, 2 clientes).
- PWA: service worker (Workbox), manifest, Offline page.
- Discount prefixado em `observacoes` como `DESC:valor|texto`.
- Máscara de telefone `(11) 99999-9999` + link WhatsApp.
- Categorias dinâmicas (tabela `categorias`, não ENUM fixo).
- `valor_venda` editável com recálculo automático de percentual de lucro.
- Logotipo Aura Semijoias na sidebar e login.

---

## Links úteis

- **Deploy:** https://aurasemijoias.vercel.app
- **Supabase Dashboard:** https://supabase.com/dashboard/project/opzjfuytvflmmjsacujc
- **GitHub:** https://github.com/vulmarjunior/aurasemijoias
- **Admin:** vulmarjunior@gmail.com
