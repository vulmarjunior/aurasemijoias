-- Conferencias persistentes de inventario com ajustes atomicos de estoque.

create table public.inventarios (
  id uuid primary key default gen_random_uuid(),
  titulo varchar(120) not null,
  observacoes text,
  status varchar(20) not null default 'EM_ANDAMENTO'
    check (status in ('EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO')),
  contagem_cega boolean not null default true,
  incluir_esgotados boolean not null default false,
  criado_por uuid not null references public.perfis(id),
  criado_por_nome varchar(100) not null,
  iniciado_em timestamptz not null default now(),
  finalizado_por uuid references public.perfis(id),
  finalizado_por_nome varchar(100),
  finalizado_em timestamptz,
  cancelado_em timestamptz,
  atualizado_em timestamptz not null default now()
);

create table public.itens_inventario (
  id uuid primary key default gen_random_uuid(),
  inventario_id uuid not null references public.inventarios(id) on delete cascade,
  produto_id uuid not null references public.produtos(id) on delete restrict,
  codigo_peca varchar(20),
  referencia varchar(30),
  nome varchar(150) not null,
  categoria varchar(50),
  quantidade_sistema integer not null check (quantidade_sistema >= 0),
  quantidade_fisica integer check (quantidade_fisica >= 0),
  diferenca integer generated always as (quantidade_fisica - quantidade_sistema) stored,
  observacoes text,
  conferido_por uuid references public.perfis(id),
  conferido_em timestamptz,
  atualizado_em timestamptz not null default now(),
  unique (inventario_id, produto_id)
);

-- Uma unica fotografia ativa evita ajustes concorrentes sobre o mesmo estoque.
create unique index inventarios_um_em_andamento_idx
  on public.inventarios ((status))
  where status = 'EM_ANDAMENTO';
create index inventarios_iniciado_em_idx on public.inventarios (iniciado_em desc);
create index itens_inventario_inventario_id_idx on public.itens_inventario (inventario_id);
create index itens_inventario_produto_id_idx on public.itens_inventario (produto_id);

alter table public.inventarios enable row level security;
alter table public.itens_inventario enable row level security;

create policy "Autenticados podem ver inventarios"
  on public.inventarios for select
  using ((select auth.role()) = 'authenticated');

create policy "Autenticados podem ver itens de inventario"
  on public.itens_inventario for select
  using ((select auth.role()) = 'authenticated');

revoke all on public.inventarios from public, anon, authenticated;
revoke all on public.itens_inventario from public, anon, authenticated;
grant select on public.inventarios to authenticated;
grant select on public.itens_inventario to authenticated;

create or replace function public.iniciar_inventario(
  p_titulo text,
  p_observacoes text default null,
  p_contagem_cega boolean default true,
  p_incluir_esgotados boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventario_id uuid;
  v_nome varchar(100);
  v_total integer;
begin
  select perfil.nome
    into v_nome
    from public.perfis as perfil
   where perfil.id = (select auth.uid())
     and perfil.ativo = true
     and perfil.perfil in ('ADMIN', 'USER');

  if not found then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para iniciar inventario';
  end if;

  if nullif(trim(p_titulo), '') is null then
    raise exception using errcode = '22023', message = 'Informe um titulo para o inventario';
  end if;

  if exists (select 1 from public.inventarios where status = 'EM_ANDAMENTO') then
    raise exception using errcode = '23505', message = 'Ja existe um inventario em andamento';
  end if;

  insert into public.inventarios (
    titulo, observacoes, contagem_cega, incluir_esgotados,
    criado_por, criado_por_nome
  ) values (
    trim(p_titulo), nullif(trim(p_observacoes), ''),
    coalesce(p_contagem_cega, true), coalesce(p_incluir_esgotados, false),
    (select auth.uid()), v_nome
  )
  returning id into v_inventario_id;

  insert into public.itens_inventario (
    inventario_id, produto_id, codigo_peca, referencia, nome, categoria,
    quantidade_sistema
  )
  select
    v_inventario_id, produto.id, produto.codigo_peca, produto.referencia,
    produto.nome, produto.categoria, produto.quantidade
    from public.produtos as produto
   where coalesce(p_incluir_esgotados, false) or produto.quantidade > 0
   order by produto.categoria nulls last, produto.nome;

  get diagnostics v_total = row_count;
  if v_total = 0 then
    raise exception using errcode = '22023', message = 'Nenhum produto disponivel para conferencia';
  end if;

  return v_inventario_id;
end;
$$;

create or replace function public.salvar_item_inventario(
  p_inventario_id uuid,
  p_item_id uuid,
  p_quantidade_fisica integer,
  p_observacoes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status varchar(20);
begin
  if not exists (
    select 1 from public.perfis as perfil
     where perfil.id = (select auth.uid())
       and perfil.ativo = true
       and perfil.perfil in ('ADMIN', 'USER')
  ) then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para conferir inventario';
  end if;

  if p_quantidade_fisica is not null and p_quantidade_fisica < 0 then
    raise exception using errcode = '22023', message = 'Quantidade fisica nao pode ser negativa';
  end if;

  -- Mantem a mesma ordem de locks da finalizacao: inventario, itens, produtos.
  select inventario.status
    into v_status
    from public.inventarios as inventario
   where inventario.id = p_inventario_id
   for update;

  if not found or v_status <> 'EM_ANDAMENTO' then
    raise exception using errcode = 'P0002', message = 'Inventario nao encontrado ou encerrado';
  end if;

  update public.itens_inventario as item
     set quantidade_fisica = p_quantidade_fisica,
         observacoes = nullif(trim(p_observacoes), ''),
         conferido_por = case when p_quantidade_fisica is null then null else (select auth.uid()) end,
         conferido_em = case when p_quantidade_fisica is null then null else now() end,
         atualizado_em = now()
   where item.id = p_item_id
     and item.inventario_id = p_inventario_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Item nao encontrado';
  end if;

  update public.inventarios
     set atualizado_em = now()
   where id = p_inventario_id;
end;
$$;

create or replace function public.finalizar_inventario(p_inventario_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventario public.inventarios%rowtype;
  v_nome varchar(100);
  v_email varchar(255);
  v_pendentes integer;
  v_ajustes integer := 0;
  v_alterados text;
  v_item record;
begin
  select perfil.nome, perfil.email
    into v_nome, v_email
    from public.perfis as perfil
   where perfil.id = (select auth.uid())
     and perfil.ativo = true
     and perfil.perfil in ('ADMIN', 'USER');

  if not found then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para finalizar inventario';
  end if;

  select * into v_inventario
    from public.inventarios
   where id = p_inventario_id
   for update;

  if not found or v_inventario.status <> 'EM_ANDAMENTO' then
    raise exception using errcode = 'P0002', message = 'Inventario nao encontrado ou ja encerrado';
  end if;

  perform item.id
    from public.itens_inventario as item
   where item.inventario_id = p_inventario_id
   order by item.id
   for update;

  select count(*) into v_pendentes
    from public.itens_inventario
   where inventario_id = p_inventario_id
     and quantidade_fisica is null;

  if v_pendentes > 0 then
    raise exception using errcode = '23514', message = format('Ainda existem %s itens sem conferencia', v_pendentes);
  end if;

  -- Bloqueia todos os produtos para tambem detectar itens que estavam zerados
  -- e ganharam estoque depois do snapshot.
  perform produto.id
    from public.produtos as produto
   order by produto.id
   for update;

  select string_agg(alterado.descricao, ', ')
    into v_alterados
    from (
      select item.nome || ' (esperado: ' || item.quantidade_sistema ||
             ', atual: ' || produto.quantidade || ')' as descricao
        from public.itens_inventario as item
        join public.produtos as produto on produto.id = item.produto_id
       where item.inventario_id = p_inventario_id
         and produto.quantidade <> item.quantidade_sistema
      union all
      select produto.nome || ' (fora do snapshot, atual: ' || produto.quantidade || ')'
        from public.produtos as produto
       where produto.quantidade > 0
         and not exists (
           select 1
             from public.itens_inventario as item
            where item.inventario_id = p_inventario_id
              and item.produto_id = produto.id
         )
    ) as alterado;

  if v_alterados is not null then
    raise exception using
      errcode = '40001',
      message = 'O estoque mudou durante a conferencia. Revise: ' || v_alterados;
  end if;

  for v_item in
    select item.produto_id, item.diferenca, item.nome
      from public.itens_inventario as item
     where item.inventario_id = p_inventario_id
       and item.diferenca <> 0
     order by item.produto_id
  loop
    insert into public.movimentacoes (
      data, produto_id, tipo, quantidade, responsavel, observacoes
    ) values (
      current_date,
      v_item.produto_id,
      case when v_item.diferenca > 0 then 'ENTRADA' else 'SAIDA' end::public.tipo_movimentacao_enum,
      abs(v_item.diferenca),
      v_nome,
      'Ajuste do inventario ' || p_inventario_id || ': ' || v_item.nome
    );
    v_ajustes := v_ajustes + 1;
  end loop;

  update public.inventarios
     set status = 'FINALIZADO',
         finalizado_por = (select auth.uid()),
         finalizado_por_nome = v_nome,
         finalizado_em = now(),
         atualizado_em = now()
   where id = p_inventario_id;

  insert into public.logs_acao (
    usuario_id, usuario_email, acao, entidade, entidade_id, detalhes
  ) values (
    (select auth.uid()), v_email, 'FINALIZAR_INVENTARIO', 'inventarios',
    p_inventario_id,
    jsonb_build_object('titulo', v_inventario.titulo, 'ajustes_realizados', v_ajustes)
  );

  return v_ajustes;
end;
$$;

create or replace function public.cancelar_inventario(p_inventario_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome varchar(100);
  v_email varchar(255);
  v_titulo varchar(120);
begin
  select perfil.nome, perfil.email
    into v_nome, v_email
    from public.perfis as perfil
   where perfil.id = (select auth.uid())
     and perfil.ativo = true
     and perfil.perfil in ('ADMIN', 'USER');

  if not found then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para cancelar inventario';
  end if;

  update public.inventarios
     set status = 'CANCELADO', cancelado_em = now(), atualizado_em = now()
   where id = p_inventario_id
     and status = 'EM_ANDAMENTO'
  returning titulo into v_titulo;

  if not found then
    raise exception using errcode = 'P0002', message = 'Inventario nao encontrado ou ja encerrado';
  end if;

  insert into public.logs_acao (
    usuario_id, usuario_email, acao, entidade, entidade_id, detalhes
  ) values (
    (select auth.uid()), v_email, 'CANCELAR_INVENTARIO', 'inventarios',
    p_inventario_id, jsonb_build_object('titulo', v_titulo, 'responsavel', v_nome)
  );
end;
$$;

revoke all on function public.iniciar_inventario(text, text, boolean, boolean) from public, anon;
revoke all on function public.salvar_item_inventario(uuid, uuid, integer, text) from public, anon;
revoke all on function public.finalizar_inventario(uuid) from public, anon;
revoke all on function public.cancelar_inventario(uuid) from public, anon;

grant execute on function public.iniciar_inventario(text, text, boolean, boolean) to authenticated;
grant execute on function public.salvar_item_inventario(uuid, uuid, integer, text) to authenticated;
grant execute on function public.finalizar_inventario(uuid) to authenticated;
grant execute on function public.cancelar_inventario(uuid) to authenticated;
