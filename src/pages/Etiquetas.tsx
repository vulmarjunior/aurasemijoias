import { supabase } from '../lib/supabase'
import { Check, Eraser, ListChecks, Printer, Search, SlidersHorizontal, Tags, X } from 'lucide-react'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

type Produto = {
  id: string
  codigo_peca: string | null
  referencia: string | null
  nome: string
  categoria: string
  quantidade: number
  valor_venda: number | null
}

type LoteItem = {
  id: string
  codigo: string
  preco: number | null
}

const PER_SHEET = 65
const COLS = 5
const PAGE_W = 210
const PAGE_H = 297
const LABEL_W = 38.2
const LABEL_H = 21.2
const MARGIN_X = 4.5
const MARGIN_Y = 10.7
const PITCH_X = 40.7
const PITCH_Y = 21.2

type FiltroEstoque = 'TODOS' | 'COM_ESTOQUE' | 'ESGOTADOS'

const printPageStyle = '@media print { @page { size: A4 portrait; margin: 0; } }'

function moeda(valor: number | null | undefined) {
  return Number(valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function posicaoEtiqueta(indice: number, offsetX: number, offsetY: number) {
  return {
    left: MARGIN_X + (indice % COLS) * PITCH_X + offsetX,
    top: MARGIN_Y + Math.floor(indice / COLS) * PITCH_Y + offsetY,
  }
}

function fonteCodigo(codigo: string, unidade: 'mm' | 'cqw') {
  if (unidade === 'mm') return codigo.length > 14 ? '2.7mm' : '3.4mm'
  return codigo.length > 14 ? '1.25cqw' : '1.62cqw'
}

function FolhaPreview({ celulas, offsetX, offsetY, modo }: {
  celulas: (LoteItem | null)[]
  offsetX: number
  offsetY: number
  modo: 'mapa' | 'preview'
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-white ring-1 ring-stone-200"
      style={{ aspectRatio: '210 / 297', containerType: 'inline-size' }}
    >
      {celulas.map((item, i) => {
        const { left, top } = posicaoEtiqueta(i, offsetX, offsetY)
        const style: CSSProperties = {
          left: `${(left / PAGE_W) * 100}%`,
          top: `${(top / PAGE_H) * 100}%`,
          width: `${(LABEL_W / PAGE_W) * 100}%`,
          height: `${(LABEL_H / PAGE_H) * 100}%`,
        }
        if (modo === 'mapa') {
          return <div key={i} className={`absolute rounded-[1px] ${item ? 'bg-brand-500' : 'bg-stone-200/80'}`} style={style} />
        }
        return (
          <div key={i} className="absolute flex flex-col items-center justify-center overflow-hidden border border-dashed border-stone-200 text-center" style={style}>
            {item && (
              <>
                <span className="font-semibold leading-none tracking-wide text-stone-500" style={{ fontSize: fonteCodigo(item.codigo, 'cqw'), whiteSpace: 'nowrap' }}>
                  {item.codigo}
                </span>
                <span className="font-bold leading-none text-stone-900" style={{ fontSize: '2.35cqw', marginTop: '0.4cqw', whiteSpace: 'nowrap' }}>
                  {item.preco === null ? '—' : moeda(item.preco)}
                </span>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function Etiquetas() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState<FiltroEstoque>('TODOS')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [skip, setSkip] = useState(0)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [ajustesAbertos, setAjustesAbertos] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => { fetchProdutos(); fetchCategorias() }, [])

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('nome').order('nome')
    if (data) setCategorias(data.map(c => c.nome))
  }

  async function fetchProdutos() {
    setLoading(true)
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo_peca, referencia, nome, categoria, quantidade, valor_venda')
      .order('codigo_peca', { ascending: true })
    if (data) setProdutos(data)
    setLoading(false)
  }

  const totalComEstoque = produtos.filter(p => p.quantidade > 0).length
  const totalEsgotados = produtos.length - totalComEstoque

  const filtered = produtos.filter(p => {
    const termo = search.trim().toLowerCase()
    const matchSearch = !termo
      || p.nome?.toLowerCase().includes(termo)
      || p.codigo_peca?.toLowerCase().includes(termo)
      || p.referencia?.toLowerCase().includes(termo)
    const matchCat = filterCat === 'TODOS' || p.categoria === filterCat
    const matchStatus =
      filterStatus === 'TODOS'
      || (filterStatus === 'COM_ESTOQUE' && p.quantidade > 0)
      || (filterStatus === 'ESGOTADOS' && p.quantidade === 0)
    return matchSearch && matchCat && matchStatus
  })

  const lote: LoteItem[] = useMemo(() => produtos
    .filter(p => selected.has(p.id))
    .map(p => ({
      id: p.id,
      codigo: p.codigo_peca?.trim() || p.referencia?.trim() || 'SEM CÓDIGO',
      preco: p.valor_venda === null ? null : Number(p.valor_venda),
    })), [produtos, selected])

  const folhas = useMemo(() => {
    if (lote.length === 0) return []
    const count = Math.ceil((skip + lote.length) / PER_SHEET)
    return Array.from({ length: count }, (_, f) => Array.from({ length: PER_SHEET }, (_, p) => {
      const idx = f * PER_SHEET + p - skip
      return idx >= 0 && idx < lote.length ? lote[idx] : null
    }))
  }, [lote, skip])

  const folhaVazia = useMemo(() => Array.from({ length: PER_SHEET }, () => null), [])
  const folhasCount = folhas.length
  const sobra = folhasCount > 0 ? folhasCount * PER_SHEET - skip - lote.length : 0
  const semCodigo = lote.filter(item => item.codigo === 'SEM CÓDIGO').length

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selecionarFiltrados() {
    setSelected(prev => new Set([...prev, ...filtered.map(p => p.id)]))
  }

  function limparSelecao() {
    setSelected(new Set())
  }

  function imprimir() {
    document.body.classList.add('labels-printing')
    const cleanup = () => document.body.classList.remove('labels-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(() => {
      window.print()
      setTimeout(cleanup, 1000)
    }, 50)
  }

  return (
    <div className="space-y-4">
      <style>{printPageStyle}</style>

      <div>
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-brand-600" />
          <h1 className="text-xl font-bold text-stone-900">Etiquetas</h1>
        </div>
        <p className="mt-1 text-sm text-stone-500">
          Imprima código e preço de venda em folhas PIMACO A4251 — 65 etiquetas por folha (38,2 × 21,2 mm).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Seleção de produtos */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
          <div className="p-5 border-b border-stone-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-stone-900">Produtos</h3>
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600">{filtered.length}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={selecionarFiltrados}
                disabled={filtered.length === 0}
                className="px-3 py-1.5 border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <ListChecks className="w-3.5 h-3.5" /> Selecionar filtrados
              </button>
              <button
                onClick={limparSelecao}
                disabled={selected.size === 0}
                className="px-3 py-1.5 border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-50 text-stone-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <Eraser className="w-3.5 h-3.5" /> Limpar
              </button>
            </div>
          </div>

          <div className="p-4 border-b border-stone-100 space-y-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, código ou referência..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setFilterCat('TODOS')}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterCat === 'TODOS' ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                Todas
              </button>
              {categorias.map(c => (
                <button
                  key={c}
                  onClick={() => setFilterCat(c === filterCat ? 'TODOS' : c)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterCat === c ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {([
                { valor: 'TODOS' as const, label: 'Todos' },
                { valor: 'COM_ESTOQUE' as const, label: `Com estoque (${totalComEstoque})` },
                { valor: 'ESGOTADOS' as const, label: `Esgotados (${totalEsgotados})` },
              ]).map(op => (
                <button
                  key={op.valor}
                  onClick={() => setFilterStatus(op.valor)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterStatus === op.valor ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-stone-400">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-stone-400 m-6 border border-dashed rounded-lg border-stone-300">Nenhum produto encontrado.</div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              {filtered.map(p => {
                const isSel = selected.has(p.id)
                return (
                  <button
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`flex w-full items-center gap-3 border-b border-stone-50 px-4 py-2.5 text-left transition-colors ${isSel ? 'bg-brand-50/70' : 'hover:bg-stone-50'}`}
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isSel ? 'border-brand-600 bg-brand-600' : 'border-stone-300 bg-white'}`}>
                      {isSel && <Check className="h-3 w-3 text-white" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-stone-500">{p.codigo_peca || p.referencia || 'Sem código'}</span>
                        {!p.codigo_peca && (
                          <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">sem código</span>
                        )}
                      </span>
                      <span className="block truncate text-sm font-medium text-stone-900">{p.nome}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-stone-900">{moeda(p.valor_venda)}</span>
                      <span className="block text-[10px] uppercase tracking-wide text-stone-400">{p.categoria}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Lote */}
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm h-fit lg:sticky lg:top-0">
          <div className="flex items-center justify-between p-5 border-b border-stone-200">
            <h3 className="text-sm font-bold text-stone-900">Lote de etiquetas</h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${lote.length > 0 ? 'bg-brand-100 text-brand-800' : 'bg-stone-100 text-stone-500'}`}>
              {lote.length}
            </span>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">1ª folha</p>
              <FolhaPreview celulas={folhas[0] ?? folhaVazia} offsetX={offsetX} offsetY={offsetY} modo="mapa" />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-stone-50 border border-stone-100 py-2">
                <div className="text-lg font-bold text-stone-900">{lote.length}</div>
                <div className="text-[10px] uppercase tracking-wide text-stone-400">Etiquetas</div>
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-100 py-2">
                <div className="text-lg font-bold text-stone-900">{folhasCount}</div>
                <div className="text-[10px] uppercase tracking-wide text-stone-400">Folhas</div>
              </div>
              <div className="rounded-lg bg-stone-50 border border-stone-100 py-2">
                <div className="text-lg font-bold text-stone-900">{sobra}</div>
                <div className="text-[10px] uppercase tracking-wide text-stone-400">Sobra</div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Iniciar na etiqueta nº</label>
              <input
                type="number"
                min={1}
                max={65}
                value={skip + 1}
                onChange={e => setSkip(Math.min(64, Math.max(0, (Number(e.target.value) || 1) - 1)))}
                className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
              />
              <p className="mt-1 text-[11px] text-stone-400">1 para folha nova; informe a posição para reaproveitar folhas com etiquetas já usadas.</p>
            </div>

            <div className="rounded-lg border border-stone-100">
              <button
                onClick={() => setAjustesAbertos(!ajustesAbertos)}
                className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900"
              >
                <span className="flex items-center gap-1.5"><SlidersHorizontal className="w-3.5 h-3.5" /> Ajustes de impressão</span>
                <span className="text-stone-400">{ajustesAbertos ? '−' : '+'}</span>
              </button>
              {ajustesAbertos && (
                <div className="border-t border-stone-100 p-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Horizontal (mm)</label>
                      <input
                        type="number" step="0.5" min={-5} max={5} value={offsetX}
                        onChange={e => setOffsetX(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Vertical (mm)</label>
                      <input
                        type="number" step="0.5" min={-5} max={5} value={offsetY}
                        onChange={e => setOffsetY(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-400">Se a impressão sair deslocada, ajuste em passos de 0,5 mm e teste em folha comum.</p>
                </div>
              )}
            </div>

            {semCodigo > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-[11px] text-red-700">
                {semCodigo} {semCodigo === 1 ? 'produto selecionado está' : 'produtos selecionados estão'} sem código de peça — a etiqueta sairá com a referência ou “SEM CÓDIGO”.
              </div>
            )}

            <button
              onClick={() => setPreviewOpen(true)}
              disabled={lote.length === 0}
              className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Visualizar e imprimir
            </button>

            <p className="text-[11px] leading-relaxed text-stone-400">
              Na janela de impressão use papel A4, escala 100% (tamanho real), margens “Padrão” e desative cabeçalhos e rodapés.
            </p>
          </div>
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-stone-200 p-5">
              <div>
                <h4 className="text-lg font-bold text-stone-900">Pré-visualização das etiquetas</h4>
                <p className="mt-0.5 text-xs text-stone-500">
                  PIMACO A4251 · {folhasCount} {folhasCount === 1 ? 'folha' : 'folhas'} · {lote.length} {lote.length === 1 ? 'etiqueta' : 'etiquetas'}
                  {skip > 0 && ` · início na posição ${skip + 1} da 1ª folha`}
                  {(offsetX !== 0 || offsetY !== 0) && ` · ajuste ${offsetX >= 0 ? '+' : ''}${offsetX} / ${offsetY >= 0 ? '+' : ''}${offsetY} mm`}
                </p>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-auto bg-stone-100 p-6 space-y-8">
              {folhas.map((celulas, fi) => (
                <div key={fi} className="mx-auto w-full max-w-md">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-stone-400">Folha {fi + 1} de {folhasCount}</p>
                  <div className="shadow-sm">
                    <FolhaPreview celulas={celulas} offsetX={offsetX} offsetY={offsetY} modo="preview" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[11px] leading-relaxed text-stone-400">
                Confira se a impressora está configurada para A4, escala 100% e margens padrão, com cabeçalhos e rodapés desativados.
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setPreviewOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Fechar</button>
                <button
                  onClick={imprimir}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {folhas.length > 0 && createPortal(
        <div className="labels-print" aria-hidden="true">
          {folhas.map((celulas, fi) => (
            <div key={fi} className="label-sheet">
              {celulas.map((item, i) => {
                const { left, top } = posicaoEtiqueta(i, offsetX, offsetY)
                return (
                  <div key={i} className="label-cell" style={{ left: `${left}mm`, top: `${top}mm` }}>
                    {item && (
                      <>
                        <span className="label-cell-code" style={{ fontSize: fonteCodigo(item.codigo, 'mm') }}>{item.codigo}</span>
                        <span className="label-cell-price">{item.preco === null ? '—' : moeda(item.preco)}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}
