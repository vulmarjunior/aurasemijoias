# Aura Semijoias CRM

Sistema web para controle de produtos, clientes, vendas e movimentações de estoque da Aura Semijoias.

## Stack

- React 19, TypeScript e Vite
- Tailwind CSS 4
- Supabase (PostgreSQL, Auth e RLS)
- PWA com Workbox
- Vercel

## Desenvolvimento local

Requisitos: Node.js 22 ou superior e um projeto Supabase configurado.

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. Instale as dependências com `npm install`.
3. Inicie o frontend com `npm run dev`.
4. Em outro terminal, inicie a API local com `npm run api`.

O frontend usa a porta `3000` e encaminha `/api` para a API local na porta `3001`.

## Comandos

- `npm run dev`: frontend em modo de desenvolvimento
- `npm run api`: API local para operações administrativas
- `npm run lint`: verificação TypeScript
- `npm run build`: build de produção
- `npm run preview`: prévia do build

## Banco de dados

As migrations versionadas ficam em `supabase/migrations`. Operações de venda e movimentação devem ser feitas pelas RPCs transacionais; não insira vendas e itens separadamente pelo frontend.

Nunca exponha `SUPABASE_SERVICE_KEY` no navegador. Apenas variáveis com prefixo `VITE_` são públicas e incorporadas ao build.

## Deploy

Produção: [aurasemijoias.vercel.app](https://aurasemijoias.vercel.app)

Configure na Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `CRON_SECRET` (segredo aleatório com pelo menos 16 caracteres)

## Keep-alive do Supabase

A Vercel chama diariamente `/api/keep-alive` às 12h UTC (08h em Manaus). A função
faz três consultas mínimas ao banco para manter atividade no projeto gratuito,
sem criar ou alterar dados. O endpoint exige `Authorization: Bearer $CRON_SECRET`;
a Vercel adiciona esse cabeçalho automaticamente quando a variável está configurada.
