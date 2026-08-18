-- Operacoes atomicas de venda e estoque.
-- Mantem os gatilhos como ultima linha de defesa para insercoes diretas.

create or replace function public.update_stock_on_sale()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
  v_disponivel integer;
begin
  update public.produtos
     set quantidade = quantidade - new.quantidade
   where id = new.produto_id
     and quantidade >= new.quantidade;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    select quantidade into v_disponivel
      from public.produtos
     where id = new.produto_id;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Produto nao encontrado';
    end if;

    raise exception using
      errcode = '23514',
      message = format('Estoque insuficiente. Disponivel: %s', v_disponivel);
  end if;

  return new;
end;
$$;

create or replace function public.process_inventory_movement()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rows integer;
  v_disponivel integer;
begin
  if new.tipo = 'ENTRADA' then
    update public.produtos
       set quantidade = quantidade + new.quantidade
     where id = new.produto_id;
  elsif new.tipo = 'SAIDA' then
    update public.produtos
       set quantidade = quantidade - new.quantidade
     where id = new.produto_id
       and quantidade >= new.quantidade;

    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      select quantidade into v_disponivel
        from public.produtos
       where id = new.produto_id;

      if not found then
        raise exception using
          errcode = '23503',
          message = 'Produto nao encontrado';
      end if;

      raise exception using
        errcode = '23514',
        message = format('Estoque insuficiente. Disponivel: %s', v_disponivel);
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.registrar_venda(
  p_data_venda date,
  p_cliente_id uuid,
  p_forma_pagamento text,
  p_valor_total numeric,
  p_observacoes text,
  p_itens jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_venda_id uuid;
  v_subtotal numeric(12, 2);
  v_indisponiveis text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado';
  end if;

  if public.user_perfil() not in ('ADMIN', 'USER') then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para registrar vendas';
  end if;

  if p_itens is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception using errcode = '22023', message = 'A venda deve possuir ao menos um item';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
     where item.produto_id is null or item.quantidade is null or item.quantidade <= 0
  ) then
    raise exception using errcode = '22023', message = 'Itens da venda invalidos';
  end if;

  -- Adquire todos os locks na mesma ordem para evitar corrida e deadlock.
  perform produto.id
    from public.produtos as produto
    join (
      select item.produto_id
        from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
       group by item.produto_id
    ) as solicitado on solicitado.produto_id = produto.id
   order by produto.id
   for update of produto;

  select string_agg(
           coalesce(produto.nome, solicitado.produto_id::text)
           || ' (disponivel: ' || coalesce(produto.quantidade, 0)
           || ', solicitado: ' || solicitado.quantidade || ')',
           ', '
         )
    into v_indisponiveis
    from (
      select item.produto_id, sum(item.quantidade)::integer as quantidade
        from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
       group by item.produto_id
    ) as solicitado
    left join public.produtos as produto on produto.id = solicitado.produto_id
   where produto.id is null or produto.quantidade < solicitado.quantidade;

  if v_indisponiveis is not null then
    raise exception using
      errcode = '23514',
      message = 'Estoque insuficiente: ' || v_indisponiveis;
  end if;

  select round(sum(produto.valor_venda * solicitado.quantidade), 2)
    into v_subtotal
    from (
      select item.produto_id, sum(item.quantidade)::integer as quantidade
        from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
       group by item.produto_id
    ) as solicitado
    join public.produtos as produto on produto.id = solicitado.produto_id;

  if p_valor_total is null or p_valor_total < 0 or round(p_valor_total, 2) > v_subtotal then
    raise exception using errcode = '22023', message = 'Valor total da venda invalido';
  end if;

  insert into public.vendas (
    data_venda, cliente_id, forma_pagamento, valor_total, observacoes
  ) values (
    coalesce(p_data_venda, current_date),
    p_cliente_id,
    p_forma_pagamento::public.forma_pagamento_enum,
    round(p_valor_total, 2),
    nullif(trim(p_observacoes), '')
  )
  returning id into v_venda_id;

  insert into public.itens_venda (
    venda_id, produto_id, quantidade, preco_venda, preco_custo
  )
  select
    v_venda_id,
    produto.id,
    solicitado.quantidade,
    produto.valor_venda,
    produto.preco_custo
  from (
    select item.produto_id, sum(item.quantidade)::integer as quantidade
      from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
     group by item.produto_id
  ) as solicitado
  join public.produtos as produto on produto.id = solicitado.produto_id
  order by produto.id;

  return v_venda_id;
end;
$$;

create or replace function public.registrar_movimentacao(
  p_data date,
  p_produto_id uuid,
  p_tipo text,
  p_quantidade integer,
  p_responsavel text,
  p_observacoes text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_movimentacao_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado';
  end if;

  if public.user_perfil() not in ('ADMIN', 'USER') then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para movimentar estoque';
  end if;

  if p_quantidade is null or p_quantidade <= 0 then
    raise exception using errcode = '22023', message = 'Quantidade deve ser maior que zero';
  end if;

  if p_tipo not in ('ENTRADA', 'SAIDA') then
    raise exception using errcode = '22023', message = 'Tipo de movimentacao invalido';
  end if;

  insert into public.movimentacoes (
    data, produto_id, tipo, quantidade, responsavel, observacoes
  ) values (
    coalesce(p_data, current_date),
    p_produto_id,
    p_tipo::public.tipo_movimentacao_enum,
    p_quantidade,
    nullif(trim(p_responsavel), ''),
    nullif(trim(p_observacoes), '')
  )
  returning id into v_movimentacao_id;

  return v_movimentacao_id;
end;
$$;

revoke all on function public.registrar_venda(date, uuid, text, numeric, text, jsonb) from public, anon;
grant execute on function public.registrar_venda(date, uuid, text, numeric, text, jsonb) to authenticated;

revoke all on function public.registrar_movimentacao(date, uuid, text, integer, text, text) from public, anon;
grant execute on function public.registrar_movimentacao(date, uuid, text, integer, text, text) to authenticated;

revoke all on function public.cancelar_venda(uuid, varchar, text) from public, anon;
grant execute on function public.cancelar_venda(uuid, varchar, text) to authenticated;

create index if not exists itens_venda_venda_id_idx on public.itens_venda (venda_id);
create index if not exists itens_venda_produto_id_idx on public.itens_venda (produto_id);
create index if not exists vendas_cliente_id_idx on public.vendas (cliente_id);
create index if not exists movimentacoes_produto_id_idx on public.movimentacoes (produto_id);
