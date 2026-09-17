-- Saida em lote de estoque: varios produtos em uma unica transacao.
-- Mantem um registro em movimentacoes por produto e delega o saldo ao gatilho.

create or replace function public.registrar_movimentacoes_lote(
  p_data date,
  p_tipo text,
  p_responsavel text,
  p_observacoes text,
  p_itens jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total integer;
  v_indisponiveis text;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Usuario nao autenticado';
  end if;

  if public.user_perfil() not in ('ADMIN', 'USER') then
    raise exception using errcode = '42501', message = 'Usuario sem permissao para movimentar estoque';
  end if;

  if p_tipo not in ('ENTRADA', 'SAIDA') then
    raise exception using errcode = '22023', message = 'Tipo de movimentacao invalido';
  end if;

  if p_itens is null
     or jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception using errcode = '22023', message = 'Informe ao menos um item';
  end if;

  if exists (
    select 1
      from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
     where item.produto_id is null or item.quantidade is null or item.quantidade <= 0
  ) then
    raise exception using errcode = '22023', message = 'Itens da movimentacao invalidos';
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

  if exists (
    select 1
      from (
        select item.produto_id
          from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
         group by item.produto_id
      ) as solicitado
      left join public.produtos as produto on produto.id = solicitado.produto_id
     where produto.id is null
  ) then
    raise exception using errcode = '23503', message = 'Produto nao encontrado';
  end if;

  if p_tipo = 'SAIDA' then
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
  end if;

  insert into public.movimentacoes (
    data, produto_id, tipo, quantidade, responsavel, observacoes
  )
  select
    coalesce(p_data, current_date),
    solicitado.produto_id,
    p_tipo::public.tipo_movimentacao_enum,
    solicitado.quantidade,
    nullif(trim(p_responsavel), ''),
    nullif(trim(p_observacoes), '')
  from (
    select item.produto_id, sum(item.quantidade)::integer as quantidade
      from jsonb_to_recordset(p_itens) as item(produto_id uuid, quantidade integer)
     group by item.produto_id
  ) as solicitado
  order by solicitado.produto_id;

  get diagnostics v_total = row_count;
  return v_total;
end;
$$;

revoke all on function public.registrar_movimentacoes_lote(date, text, text, text, jsonb) from public, anon;
grant execute on function public.registrar_movimentacoes_lote(date, text, text, text, jsonb) to authenticated;
