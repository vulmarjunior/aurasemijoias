# Especificação Técnica — CRM AURA SEMIJOIAS
> Documento gerado a partir da planilha controle_semijoias_AURA_-_COLLARE.xlsx

...

**Empresa:** AURA SEMIJOIAS  
**Segmento:** Venda de semijoias (anéis, colares, brincos, pulseiras, conjuntos, tornozeleiras)  
**Modelo de negócio:** Revenda com controle de estoque, clientes e fluxo de caixa  
**Objetivo da migração:** Substituir planilha Excel por CRM online com banco de dados relacional e interface web moderna

---

## 2. Entidades do Banco de Dados

### 2.1 produtos (origem: aba "Controle de Estoque")

| Campo              | Tipo          | Descrição                                      | Exemplo                         |
|--------------------|---------------|------------------------------------------------|---------------------------------|
| id                 | UUID / PK     | Identificador interno                          | —                               |
| codigo_peca        | VARCHAR(20)   | Código numérico da peça                        | 110298                          |
| referencia         | VARCHAR(30)   | Código de referência do fornecedor             | CLR00000070A                    |
| nome               | VARCHAR(150)  | Nome descritivo da peça                        | NA-18D COR DOURADO TAMANHO 18   |
| categoria          | ENUM          | Tipo de semijoia                               | Ver valores abaixo              |
| quantidade         | INTEGER       | Qtd atual em estoque (inclui 0)                | 1, 0                            |
| preco_custo        | DECIMAL(10,2) | Preço de custo (R$)                            | 59.90                           |
| percentual_lucro   | DECIMAL(5,2)  | Multiplicador de lucro (atualmente sempre 1)   | 1.00                            |
| valor_venda        | DECIMAL(10,2) | Preço de venda = custo × (1 + lucro)           | 119.80                          |
| lucro_unitario     | DECIMAL(10,2) | Lucro por unidade vendida                      | 59.90                           |
| lucro_total        | DECIMAL(10,2) | lucro_unitario × quantidade                    | 59.90                           |
| status             | ENUM          | Status do estoque                              | Ver valores abaixo              |
| criado_em          | TIMESTAMP     | Data de cadastro                               | —                               |
| atualizado_em      | TIMESTAMP     | Última atualização                             | —                               |

**Categorias (ENUM categoria):**
- ANEL
- BRINCO
- COLAR
- PULSEIRA
- CONJUNTO
- TORNOZELEIRA

**Status do estoque (ENUM status):**
- EM_ESTOQUE — quantidade ≥ 3
- BAIXA_NO_ESTOQUE — quantidade entre 1 e 2
- ESGOTADO — quantidade = 0

> ⚠️ O status deve ser calculado automaticamente a partir da quantidade. Não armazenar manualmente.

**Faixa de preços real dos dados:**
- Custo mínimo: R$ 39,90 | máximo: R$ 7.183,40
- Venda mínima: R$ 0,00 | máxima: R$ 14.369,70

---

### 2.2 clientes (origem: aba "Clientes")

| Campo           | Tipo         | Descrição                          | Exemplo        |
|-----------------|--------------|------------------------------------|----------------|
| id              | UUID / PK    | Identificador interno              | —              |
| nome            | VARCHAR(100) | Nome completo                      | Carine IBO     |
| telefone        | VARCHAR(20)  | WhatsApp/telefone                  | (69) 9xxxx     |
| instagram       | VARCHAR(50)  | @ do Instagram                     | @carine        |
| observacoes     | TEXT         | Notas livres (ex: parcelas aceitas)| 2x             |
| criado_em       | TIMESTAMP    | Data de cadastro                   | —              |
| atualizado_em   | TIMESTAMP    | Última atualização                 | —              |

> ℹ️ O campo "Última compra" da planilha original é substituído por relacionamento com a tabela vendas.

---

### 2.3 vendas (origem: aba "Vendas Realizadas")

| Campo              | Tipo          | Descrição                          | Exemplo        |
|--------------------|---------------|------------------------------------|----------------|
| id                 | UUID / PK     | Identificador interno              | —              |
| data_venda         | DATE          | Data da venda                      | 2024-03-15     |
| cliente_id         | FK → clientes | Cliente comprador                  | —              |
| forma_pagamento    | ENUM          | Como foi pago                      | Ver abaixo     |
| valor_total        | DECIMAL(10,2) | Soma dos itens                     | 359.80         |
| observacoes        | TEXT          | Notas adicionais                   | —              |
| criado_em          | TIMESTAMP     | —                                  | —              |

**Formas de pagamento (ENUM):**
- PIX
- DINHEIRO
- CARTAO_CREDITO
- CARTAO_DEBITO
- PARCELADO (ex: "2x", "3x" mencionado nas observações)
- OUTRO

---

### 2.4 itens_venda (tabela de junção N:N entre vendas e produtos)

| Campo         | Tipo          | Descrição                    |
|---------------|---------------|------------------------------|
| id            | UUID / PK     | —                            |
| venda_id      | FK → vendas   | —                            |
| produto_id    | FK → produtos | —                            |
| quantidade    | INTEGER       | Qtd vendida                  |
| preco_venda   | DECIMAL(10,2) | Preço no momento da venda    |
| preco_custo   | DECIMAL(10,2) | Custo no momento da venda    |
| lucro         | DECIMAL(10,2) | preco_venda - preco_custo    |

> ⚠️ Registrar preço no momento da venda (snapshot), pois o preço do produto pode mudar.

---

### 2.5 movimentacoes (origem: aba "Entrada e Saída")

| Campo         | Tipo          | Descrição                         | Exemplo       |
|---------------|---------------|-----------------------------------|---------------|
| id            | UUID / PK     | —                                 | —             |
| data          | DATE          | Data da movimentação              | —             |
| produto_id    | FK → produtos | Produto movimentado               | —             |
| tipo          | ENUM          | ENTRADA ou SAIDA                  | —             |
| quantidade    | INTEGER       | Quantidade movimentada            | —             |
| responsavel   | VARCHAR(100)  | Nome de quem fez a movimentação   | —             |
| observacoes   | TEXT          | Notas                             | —             |
| criado_em     | TIMESTAMP     | —                                 | —             |

---

## 3. Diagrama de Relacionamentos (ERD simplificado)

clientes (1) ────────── (N) vendas
                              │
                          (1) │ (N)
                         itens_venda
                              │
                          (N) │ (1)
                           produtos
                              │
                          (1) │ (N)
                       movimentacoes

---

## 4. Regras de Negócio

1. **Cálculo automático de status do estoque:**  
   - quantidade = 0 → ESGOTADO  
   - quantidade entre 1 e 2 → BAIXA_NO_ESTOQUE  
   - quantidade ≥ 3 → EM_ESTOQUE

2. **Cálculo automático de valor de venda:**  
   valor_venda = preco_custo × (1 + percentual_lucro)  
   *(atualmente o percentual está sempre como 1, equivalendo a 100% de markup)*

3. **Atualização de estoque ao registrar venda:**  
   Ao criar uma venda, subtrair a quantidade vendida de produtos.quantidade.

4. **Atualização de estoque ao registrar movimentação:**  
   - Tipo ENTRADA: somar a quantidade  
   - Tipo SAIDA: subtrair de quantidade  
   - Nunca permitir quantidade < 0

5. **Snapshot de preço em itens_venda:**  
   Sempre copiar preco_venda e preco_custo no momento da venda, independente de alterações futuras no produto.

6. **Cliente pode ter múltiplas compras.**

7. **Uma venda pode ter múltiplos produtos (itens_venda).**

---

## 5. Módulos do Frontend

### 5.1 Dashboard
- Resumo de: total de produtos, total em estoque, produtos esgotados, baixo estoque
- Total de vendas do mês
- Lucro do mês
- Últimas vendas realizadas
- Alertas de estoque crítico (esgotado e baixo)

### 5.2 Estoque (Produtos)
- Listagem com filtros por: categoria, status, faixa de preço
- Busca por nome, código ou referência
- Cadastro e edição de produto
- Visualização de detalhes com histórico de movimentações
- Indicador visual de status (tag colorida)

### 5.3 Clientes
- Listagem de clientes
- Cadastro e edição
- Perfil do cliente com histórico de compras

### 5.4 Vendas
- Registro de nova venda (selecionar cliente + adicionar produtos com qtd)
- Cálculo automático do valor total
- Listagem de vendas com filtros por data, cliente, forma de pagamento
- Detalhamento de venda (itens, lucro, margem)

### 5.5 Movimentações (Entrada e Saída)
- Registro de entrada ou saída de estoque
- Listagem por produto ou por período
- Campo de responsável e observações

### 5.6 Relatórios
- Faturamento por período
- Lucro por categoria
- Produtos mais vendidos
- Clientes com maior volume de compras

---

## 10. Checklist de Implementação (AI Studio)

- [ ] Criar projeto React com Tailwind CSS e PWA plugin
- [ ] Configurar cliente Supabase (lib/supabaseClient.ts)
- [ ] Criar banco de dados Supabase e executar DDL (necessário via UI do Supabase pelo usuário)
- [ ] Implementar componentes da UI (Dashboard, Produtos, Clientes, Vendas)
- [ ] Implementar roteamento (react-router)
- [ ] Adicionar suporte a Analytics (eventos PWA e track page views)
