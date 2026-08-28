import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileCheck2,
  HelpCircle,
  History,
  Plus,
  Printer,
  Search,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit } from '../lib/permissions'

type StatusInventario = 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO'
type FiltroItens = 'TODOS' | 'PENDENTES' | 'DIVERGENTES' | 'CONFERIDOS'
type EstadoSalvamento = 'idle' | 'saving' | 'saved' | 'error'

type ResumoItem = {
  id: string
  quantidade_sistema: number
  quantidade_fisica: number | null
  diferenca: number | null
}

type Inventario = {
  id: string
  titulo: string
  observacoes: string | null
  status: StatusInventario
  contagem_cega: boolean
  incluir_esgotados: boolean
  criado_por_nome: string
  iniciado_em: string
  finalizado_por_nome: string | null
  finalizado_em: string | null
  atualizado_em: string
  itens_inventario?: ResumoItem[]
}

type ItemInventario = {
  id: string
  inventario_id: string
  produto_id: string
  codigo_peca: string | null
  referencia: string | null
  nome: string
  categoria: string | null
  quantidade_sistema: number
  quantidade_fisica: number | null
  diferenca: number | null
  observacoes: string | null
}

const statusLabel: Record<StatusInventario, string> = {
  EM_ANDAMENTO: 'Em andamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

const statusColor: Record<StatusInventario, string> = {
  EM_ANDAMENTO: 'bg-yellow-100 text-yellow-800',
  FINALIZADO: 'bg-green-100 text-green-800',
  CANCELADO: 'bg-stone-100 text-stone-600',
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getResumo(itens: Array<ResumoItem | ItemInventario>) {
  const total = itens.length
  const conferidos = itens.filter(item => item.quantidade_fisica !== null).length
  const divergentes = itens.filter(item => item.quantidade_fisica !== null && item.diferenca !== 0).length
  const unidadesSistema = itens.reduce((totalAtual, item) => totalAtual + item.quantidade_sistema, 0)
  const unidadesFisicas = itens.reduce((totalAtual, item) => totalAtual + (item.quantidade_fisica ?? 0), 0)
  return { total, conferidos, divergentes, unidadesSistema, unidadesFisicas }
}

export function Inventarios() {
  const { user } = useAuth()
  const [inventarios, setInventarios] = useState<Inventario[]>([])
  const [selecionado, setSelecionado] = useState<Inventario | null>(null)
  const [itens, setItens] = useState<ItemInventario[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingItens, setLoadingItens] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [savingNew, setSavingNew] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [search, setSearch] = useState('')
  const [filtro, setFiltro] = useState<FiltroItens>('TODOS')
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)
  const [saveStates, setSaveStates] = useState<Record<string, EstadoSalvamento>>({})
  const [printMode, setPrintMode] = useState<'MANUAL' | 'RESULTADO'>('MANUAL')
  const [form, setForm] = useState({
    titulo: '',
    observacoes: '',
    contagem_cega: true,
    incluir_esgotados: false,
  })

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const saveVersions = useRef<Record<string, number>>({})
  const saveQueues = useRef<Record<string, Promise<void>>>({})
  const dirtyIds = useRef(new Set<string>())
  const itensRef = useRef<ItemInventario[]>([])
  const loadVersion = useRef(0)

  useEffect(() => {
    void fetchInventarios()
    const warnPendingSave = (event: BeforeUnloadEvent) => {
      if (dirtyIds.current.size === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnPendingSave)
    return () => {
      window.removeEventListener('beforeunload', warnPendingSave)
      Object.values(saveTimers.current).forEach(clearTimeout)
    }
  }, [])

  async function fetchInventarios(preferirId?: string) {
    setLoading(true)
    const { data, error } = await supabase
      .from('inventarios')
      .select('*, itens_inventario(id, quantidade_sistema, quantidade_fisica, diferenca)')
      .order('iniciado_em', { ascending: false })

    if (error) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível carregar os inventários: ' + error.message })
      setLoading(false)
      return
    }

    const lista = (data || []) as Inventario[]
    setInventarios(lista)
    setLoading(false)

    const alvo = lista.find(item => item.id === preferirId)
      || lista.find(item => item.status === 'EM_ANDAMENTO')
      || lista[0]
    if (alvo) await abrirInventario(alvo)
  }

  async function abrirInventario(inventario: Inventario) {
    if (!(await flushSaves())) {
      setMensagem({ tipo: 'error', texto: 'Corrija o erro de salvamento antes de trocar de inventário.' })
      return
    }
    const version = ++loadVersion.current
    setSelecionado(inventario)
    setLoadingItens(true)
    setItens([])
    itensRef.current = []
    setSearch('')
    setFiltro('TODOS')

    const { data, error } = await supabase
      .from('itens_inventario')
      .select('*')
      .eq('inventario_id', inventario.id)
      .order('categoria', { ascending: true, nullsFirst: false })
      .order('nome')

    if (version !== loadVersion.current) return
    if (error) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível carregar os itens: ' + error.message })
      setItens([])
      itensRef.current = []
    } else {
      const lista = (data || []) as ItemInventario[]
      setItens(lista)
      itensRef.current = lista
    }
    setLoadingItens(false)
  }

  function openNew() {
    setForm({
      titulo: `Conferência ${new Date().toLocaleDateString('pt-BR')}`,
      observacoes: '',
      contagem_cega: true,
      incluir_esgotados: false,
    })
    setModalOpen(true)
    setMensagem(null)
  }

  async function handleCreate() {
    if (!form.titulo.trim()) return
    setSavingNew(true)
    const { data, error } = await supabase.rpc('iniciar_inventario', {
      p_titulo: form.titulo,
      p_observacoes: form.observacoes || null,
      p_contagem_cega: form.contagem_cega,
      p_incluir_esgotados: form.incluir_esgotados,
    })
    setSavingNew(false)

    if (error) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível iniciar: ' + error.message })
      setModalOpen(false)
      return
    }

    setModalOpen(false)
    setMensagem({ tipo: 'success', texto: 'Inventário iniciado. As contagens são salvas automaticamente.' })
    await fetchInventarios(data as string)
  }

  function updateItem(item: ItemInventario, changes: Partial<ItemInventario>) {
    if (!selecionado || selecionado.status !== 'EM_ANDAMENTO') return
    const atualizado = { ...item, ...changes }
    if ('quantidade_fisica' in changes) {
      atualizado.diferenca = atualizado.quantidade_fisica === null
        ? null
        : atualizado.quantidade_fisica - atualizado.quantidade_sistema
    }

    const proximos = itensRef.current.map(atual => atual.id === item.id ? atualizado : atual)
    itensRef.current = proximos
    setItens(proximos)
    scheduleSave(atualizado)
  }

  function scheduleSave(item: ItemInventario) {
    dirtyIds.current.add(item.id)
    saveVersions.current[item.id] = (saveVersions.current[item.id] || 0) + 1
    const version = saveVersions.current[item.id]
    setSaveStates(states => ({ ...states, [item.id]: 'saving' }))
    clearTimeout(saveTimers.current[item.id])
    saveTimers.current[item.id] = setTimeout(() => void enqueueSave(item, version), 650)
  }

  function enqueueSave(item: ItemInventario, version: number) {
    const anterior = saveQueues.current[item.id] || Promise.resolve()
    const proximo = anterior.catch(() => undefined).then(() => saveItem(item, version))
    saveQueues.current[item.id] = proximo
    return proximo
  }

  function flushItem(itemId: string) {
    if (!dirtyIds.current.has(itemId)) return
    clearTimeout(saveTimers.current[itemId])
    const item = itensRef.current.find(atual => atual.id === itemId)
    if (item) void enqueueSave(item, saveVersions.current[itemId])
  }

  async function saveItem(item: ItemInventario, version: number) {
    const { error } = await supabase.rpc('salvar_item_inventario', {
      p_inventario_id: item.inventario_id,
      p_item_id: item.id,
      p_quantidade_fisica: item.quantidade_fisica,
      p_observacoes: item.observacoes || null,
    })

    if (version !== saveVersions.current[item.id]) return
    if (error) {
      setSaveStates(states => ({ ...states, [item.id]: 'error' }))
      setMensagem({ tipo: 'error', texto: `Erro ao salvar ${item.nome}: ${error.message}` })
      return
    }

    dirtyIds.current.delete(item.id)
    setSaveStates(states => ({ ...states, [item.id]: 'saved' }))
  }

  async function flushSaves() {
    const pendentes = Array.from(dirtyIds.current)
    if (pendentes.length === 0) return true
    const saves = pendentes.map(id => {
      clearTimeout(saveTimers.current[id])
      const item = itensRef.current.find(atual => atual.id === id)
      if (!item) return Promise.resolve()
      return enqueueSave(item, saveVersions.current[id])
    })
    await Promise.all(saves)
    return dirtyIds.current.size === 0
  }

  async function handleFinalize() {
    if (!selecionado) return
    const resumo = getResumo(itens)
    if (resumo.conferidos < resumo.total) {
      setFiltro('PENDENTES')
      setMensagem({ tipo: 'error', texto: `Ainda existem ${resumo.total - resumo.conferidos} produtos sem contagem.` })
      return
    }
    if (!confirm(`Finalizar a conferência e aplicar ajustes em ${resumo.divergentes} produto(s)? Esta ação não pode ser desfeita.`)) return

    setProcessing(true)
    const saved = await flushSaves()
    if (!saved) {
      setProcessing(false)
      setMensagem({ tipo: 'error', texto: 'Existem alterações que não foram salvas. Tente novamente.' })
      return
    }

    const { data, error } = await supabase.rpc('finalizar_inventario', { p_inventario_id: selecionado.id })
    setProcessing(false)
    if (error) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível finalizar: ' + error.message })
      return
    }

    setMensagem({ tipo: 'success', texto: `Inventário finalizado com ${Number(data)} ajuste(s) de estoque.` })
    await fetchInventarios(selecionado.id)
  }

  async function handleCancel() {
    if (!selecionado || !confirm('Cancelar esta conferência? As contagens serão preservadas apenas para consulta e nenhum ajuste será aplicado.')) return
    setProcessing(true)
    const saved = await flushSaves()
    if (!saved) {
      setProcessing(false)
      setMensagem({ tipo: 'error', texto: 'Existem alterações que não foram salvas. Tente novamente.' })
      return
    }
    const { error } = await supabase.rpc('cancelar_inventario', { p_inventario_id: selecionado.id })
    setProcessing(false)
    if (error) {
      setMensagem({ tipo: 'error', texto: 'Não foi possível cancelar: ' + error.message })
      return
    }
    setMensagem({ tipo: 'success', texto: 'Conferência cancelada sem alterar o estoque.' })
    await fetchInventarios(selecionado.id)
  }

  function imprimir(modo: 'MANUAL' | 'RESULTADO') {
    setPrintMode(modo)
    document.body.classList.add('inventory-printing')
    const cleanup = () => document.body.classList.remove('inventory-printing')
    window.addEventListener('afterprint', cleanup, { once: true })
    setTimeout(() => {
      window.print()
      setTimeout(cleanup, 1000)
    }, 0)
  }

  const resumo = getResumo(itens)
  const progresso = resumo.total > 0 ? Math.round((resumo.conferidos / resumo.total) * 100) : 0
  const podeEditar = selecionado?.status === 'EM_ANDAMENTO' && canEdit(user?.perfil)
  const termo = search.toLowerCase()
  const itensFiltrados = itens.filter(item => {
    const matchSearch = !termo
      || item.nome.toLowerCase().includes(termo)
      || item.codigo_peca?.toLowerCase().includes(termo)
      || item.referencia?.toLowerCase().includes(termo)
      || item.categoria?.toLowerCase().includes(termo)
    const matchFiltro = filtro === 'TODOS'
      || (filtro === 'PENDENTES' && item.quantidade_fisica === null)
      || (filtro === 'DIVERGENTES' && item.quantidade_fisica !== null && item.diferenca !== 0)
      || (filtro === 'CONFERIDOS' && item.quantidade_fisica !== null)
    return matchSearch && matchFiltro
  })

  return (
    <div className="space-y-4 no-print">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-brand-600" />
            <h1 className="text-xl font-bold text-stone-900">Conferência de Inventário</h1>
          </div>
          <p className="mt-1 text-sm text-stone-500">Conte o estoque físico, retome depois ou imprima uma folha de conferência.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => setHelpOpen(true)} className="flex items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50">
            <HelpCircle className="h-4 w-4 text-brand-600" /> Como usar
          </button>
          {canEdit(user?.perfil) && !inventarios.some(item => item.status === 'EM_ANDAMENTO') && (
            <button onClick={openNew} className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Nova conferência
            </button>
          )}
        </div>
      </div>

      {mensagem && (
        <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${mensagem.tipo === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
          {mensagem.tipo === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="flex-1">{mensagem.texto}</span>
          <button onClick={() => setMensagem(null)} aria-label="Fechar mensagem"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-3">
            <History className="h-4 w-4 text-stone-400" />
            <h2 className="text-sm font-bold text-stone-800">Histórico</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-stone-400">Carregando...</div>
          ) : inventarios.length === 0 ? (
            <div className="p-6 text-center text-sm text-stone-400">Nenhuma conferência criada.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto xl:max-h-[calc(100vh-15rem)]">
              {inventarios.map(inventario => {
                const itemResumo = getResumo(inventario.itens_inventario || [])
                return (
                  <button
                    key={inventario.id}
                    onClick={() => void abrirInventario(inventario)}
                    className={`w-full border-b border-stone-100 p-4 text-left transition-colors last:border-0 ${selecionado?.id === inventario.id ? 'bg-brand-50' : 'hover:bg-stone-50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-stone-900">{inventario.titulo}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusColor[inventario.status]}`}>{statusLabel[inventario.status]}</span>
                    </div>
                    <div className="mt-2 text-xs text-stone-500">{formatDateTime(inventario.iniciado_em)}</div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                      <span>{itemResumo.conferidos}/{itemResumo.total} conferidos</span>
                      <span>{itemResumo.divergentes} divergências</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {!selecionado ? (
            <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
              <FileCheck2 className="mb-3 h-10 w-10 text-stone-300" />
              <h2 className="font-semibold text-stone-700">Nenhum inventário selecionado</h2>
              <p className="mt-1 max-w-sm text-sm text-stone-400">Crie uma conferência para registrar a contagem física ou imprimir a planilha manual.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-stone-100 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-stone-900">{selecionado.titulo}</h2>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor[selecionado.status]}`}>{statusLabel[selecionado.status]}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">
                        {selecionado.contagem_cega ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {selecionado.contagem_cega ? 'Contagem cega' : 'Contagem aberta'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">Iniciado por {selecionado.criado_por_nome} em {formatDateTime(selecionado.iniciado_em)}</p>
                    {selecionado.observacoes && <p className="mt-2 text-sm text-stone-600">{selecionado.observacoes}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => imprimir('MANUAL')} disabled={loadingItens} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <Printer className="h-4 w-4" /> Imprimir para contagem
                    </button>
                    {selecionado.status !== 'EM_ANDAMENTO' && (
                      <button onClick={() => imprimir('RESULTADO')} disabled={loadingItens} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50">
                        <FileCheck2 className="h-4 w-4" /> Imprimir resultado
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-stone-50 px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Produtos</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums text-stone-900">{resumo.total}</div>
                  </div>
                  <div className="rounded-lg bg-brand-50 px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Progresso</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums text-brand-900">{progresso}%</div>
                  </div>
                  <div className="rounded-lg bg-yellow-50 px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-yellow-700">Pendentes</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums text-yellow-900">{resumo.total - resumo.conferidos}</div>
                  </div>
                  <div className="rounded-lg bg-red-50 px-3 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Divergências</div>
                    <div className="mt-0.5 text-xl font-bold tabular-nums text-red-900">{resumo.divergentes}</div>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progresso}%` }} />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-b border-stone-100 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                  <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Produto, código, referência..." className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
                <div className="flex gap-1 overflow-x-auto rounded-lg bg-stone-100 p-1">
                  {(['TODOS', 'PENDENTES', 'DIVERGENTES', 'CONFERIDOS'] as FiltroItens[]).map(opcao => (
                    <button key={opcao} onClick={() => setFiltro(opcao)} className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${filtro === opcao ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}>
                      {opcao.charAt(0) + opcao.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {loadingItens ? (
                <div className="py-16 text-center text-sm text-stone-400">Carregando itens...</div>
              ) : itensFiltrados.length === 0 ? (
                <div className="m-6 rounded-lg border border-dashed border-stone-300 py-12 text-center text-sm text-stone-400">Nenhum item neste filtro.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead>
                      <tr className="border-b border-stone-100 bg-stone-50/70 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                        <th className="w-9 px-3 py-3 text-center"><Check className="mx-auto h-3.5 w-3.5" /></th>
                        <th className="px-3 py-3 text-left">Peça</th>
                        <th className="px-3 py-3 text-left">Categoria</th>
                        {!selecionado.contagem_cega && <th className="px-3 py-3 text-center">Sistema</th>}
                        <th className="w-28 px-3 py-3 text-center">Qtd. física</th>
                        <th className="w-24 px-3 py-3 text-center">Diferença</th>
                        <th className="px-3 py-3 text-left">Observação</th>
                        <th className="w-20 px-3 py-3 text-right">Salvo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itensFiltrados.map(item => {
                        const conferido = item.quantidade_fisica !== null
                        const saveState = saveStates[item.id] || 'idle'
                        return (
                          <tr key={item.id} className={`border-b border-stone-100 transition-colors ${conferido ? 'bg-white' : 'bg-yellow-50/30'} ${item.diferenca ? 'border-l-2 border-l-red-400' : ''}`}>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`mx-auto flex h-5 w-5 items-center justify-center rounded border ${conferido ? 'border-green-500 bg-green-500 text-white' : 'border-stone-300 bg-white text-transparent'}`}>
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-stone-900">{item.nome}</div>
                              <div className="mt-0.5 font-mono text-[11px] text-stone-400">{item.codigo_peca || 'Sem código'}{item.referencia ? ` · ${item.referencia}` : ''}</div>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-stone-500">{item.categoria || '-'}</td>
                            {!selecionado.contagem_cega && <td className="px-3 py-2.5 text-center font-semibold tabular-nums text-stone-700">{item.quantidade_sistema}</td>}
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                inputMode="numeric"
                                value={item.quantidade_fisica ?? ''}
                                disabled={!podeEditar}
                                onChange={event => {
                                  if (event.target.value === '') {
                                    updateItem(item, { quantidade_fisica: null })
                                    return
                                  }
                                  const quantidade = Number(event.target.value)
                                  if (Number.isSafeInteger(quantidade) && quantidade >= 0) updateItem(item, { quantidade_fisica: quantidade })
                                }}
                                onBlur={() => flushItem(item.id)}
                                aria-label={`Quantidade física de ${item.nome}`}
                                className="w-full rounded-md border border-stone-200 bg-stone-50 px-2 py-2 text-center font-bold tabular-nums text-stone-900 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-stone-100 disabled:text-stone-500"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              {conferido ? (
                                <span className={`inline-flex min-w-9 justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${item.diferenca === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                  {item.diferenca && item.diferenca > 0 ? '+' : ''}{item.diferenca}
                                </span>
                              ) : <span className="text-stone-300">-</span>}
                            </td>
                            <td className="px-3 py-2.5">
                              <input
                                value={item.observacoes || ''}
                                disabled={!podeEditar}
                                onChange={event => updateItem(item, { observacoes: event.target.value })}
                                onBlur={() => flushItem(item.id)}
                                placeholder="Opcional"
                                aria-label={`Observação de ${item.nome}`}
                                className="w-full rounded-md border border-transparent bg-transparent px-2 py-2 text-xs text-stone-600 hover:border-stone-200 focus:border-brand-500 focus:bg-white focus:outline-none disabled:text-stone-400"
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right text-[11px]">
                              {saveState === 'saving' && <span className="text-brand-700">Salvando...</span>}
                              {saveState === 'saved' && <span className="text-green-700">Salvo</span>}
                              {saveState === 'error' && <span className="text-red-700">Erro</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {podeEditar && (
                <div className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <button onClick={() => void handleCancel()} disabled={processing} className="inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-red-700 disabled:opacity-50">
                    <X className="h-4 w-4" /> Cancelar conferência
                  </button>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                    <span className="text-xs text-stone-500">{resumo.conferidos === resumo.total ? 'Todos os produtos foram contados.' : `${resumo.total - resumo.conferidos} produto(s) pendente(s)`}</span>
                    <button onClick={() => void handleFinalize()} disabled={processing || resumo.conferidos < resumo.total} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300">
                      <FileCheck2 className="h-4 w-4" /> {processing ? 'Processando...' : 'Finalizar e ajustar estoque'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => !savingNew && setModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="novo-inventario-titulo" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h2 id="novo-inventario-titulo" className="text-lg font-bold text-stone-900">Nova conferência</h2>
                <p className="mt-1 text-sm text-stone-500">O estoque atual será registrado como referência.</p>
              </div>
              <button onClick={() => setModalOpen(false)} disabled={savingNew} className="text-stone-400 hover:text-stone-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Título *</label>
                <input value={form.titulo} onChange={event => setForm({ ...form, titulo: event.target.value })} className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Observações</label>
                <textarea value={form.observacoes} onChange={event => setForm({ ...form, observacoes: event.target.value })} rows={2} placeholder="Ex.: contagem do estoque da vitrine e depósito" className="w-full resize-none rounded-lg border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 transition-colors hover:bg-stone-50">
                <input type="checkbox" checked={form.contagem_cega} onChange={event => setForm({ ...form, contagem_cega: event.target.checked })} className="mt-0.5 h-4 w-4 accent-amber-600" />
                <span>
                  <span className="block text-sm font-semibold text-stone-800">Contagem cega</span>
                  <span className="block text-xs text-stone-500">Oculta a quantidade do sistema para não influenciar a contagem.</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-stone-200 p-3 transition-colors hover:bg-stone-50">
                <input type="checkbox" checked={form.incluir_esgotados} onChange={event => setForm({ ...form, incluir_esgotados: event.target.checked })} className="mt-0.5 h-4 w-4 accent-amber-600" />
                <span>
                  <span className="block text-sm font-semibold text-stone-800">Incluir produtos esgotados</span>
                  <span className="block text-xs text-stone-500">Útil para localizar peças físicas registradas com saldo zero.</span>
                </span>
              </label>
              <div className="flex gap-2 rounded-lg bg-yellow-50 p-3 text-xs text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Evite vendas e movimentações até finalizar. Se o estoque mudar, o sistema bloqueará os ajustes para proteger a contagem.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-stone-100 pt-4">
              <button onClick={() => setModalOpen(false)} disabled={savingNew} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900">Voltar</button>
              <button onClick={() => void handleCreate()} disabled={savingNew || !form.titulo.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-brand-400">
                <ClipboardCheck className="h-4 w-4" /> {savingNew ? 'Criando...' : 'Iniciar conferência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4" onClick={() => setHelpOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="ajuda-inventario-titulo" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="sticky top-0 flex items-start justify-between border-b border-stone-100 bg-white p-5">
              <div>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-brand-600" />
                  <h2 id="ajuda-inventario-titulo" className="text-lg font-bold text-stone-900">Como conferir o inventário</h2>
                </div>
                <p className="mt-1 text-sm text-stone-500">Da abertura da contagem ao ajuste final do estoque.</p>
              </div>
              <button onClick={() => setHelpOpen(false)} aria-label="Fechar ajuda" className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-6 p-5">
              <div className="flex gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-700" />
                <div>
                  <div className="font-bold">Antes de começar</div>
                  <p className="mt-1 text-yellow-800">Evite vendas e movimentações enquanto a conferência estiver aberta. Se o estoque mudar, a finalização será bloqueada para proteger a contagem.</p>
                </div>
              </div>

              <HelpSection number="1" title="Inicie a conferência">
                Clique em <strong>Nova conferência</strong>, informe um título e escolha entre contagem cega, que oculta o saldo esperado, ou aberta, que mostra a quantidade do sistema. Marque produtos esgotados se também quiser procurar peças registradas com saldo zero.
              </HelpSection>

              <HelpSection number="2" title="Conte e salve">
                Digite a quantidade física de cada produto. O check verde indica que o item foi contado e o salvamento é automático. Quantidade zero também é uma contagem válida. Você pode fechar a tela e retomar depois, inclusive em outro dispositivo.
              </HelpSection>

              <HelpSection number="3" title="Revise as diferenças">
                Use os filtros <strong>Pendentes</strong> e <strong>Divergentes</strong>. Reconte as diferenças e registre observações para peças ausentes, excedentes ou avariadas.
              </HelpSection>

              <HelpSection number="4" title="Finalize e ajuste o estoque">
                Quando todos os itens estiverem contados, clique em <strong>Finalizar e ajustar estoque</strong>. Diferenças positivas geram entrada; diferenças negativas geram saída. Tudo fica registrado nas movimentações e na auditoria.
              </HelpSection>

              <div className="rounded-lg bg-stone-50 p-4">
                <div className="flex items-center gap-2 font-bold text-stone-800"><Printer className="h-4 w-4 text-brand-600" /> Prefere contar no papel?</div>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">Clique em <strong>Imprimir para contagem</strong>, preencha a folha e depois digite os resultados nesta tela. Após finalizar, use <strong>Imprimir resultado</strong> para gerar o relatório final ou salvar em PDF.</p>
              </div>
            </div>

            <div className="sticky bottom-0 flex justify-end border-t border-stone-100 bg-white p-4">
              <button onClick={() => setHelpOpen(false)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">Entendi</button>
            </div>
          </div>
        </div>
      )}

      {selecionado && (
        <InventoryPrint inventario={selecionado} itens={itens} mode={printMode} />
      )}
    </div>
  )
}

function HelpSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-800">{number}</span>
      <div>
        <h3 className="font-bold text-stone-800">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{children}</p>
      </div>
    </div>
  )
}

function InventoryPrint({ inventario, itens, mode }: { inventario: Inventario; itens: ItemInventario[]; mode: 'MANUAL' | 'RESULTADO' }) {
  const resumo = getResumo(itens)
  const mostrarSistema = mode === 'RESULTADO' || !inventario.contagem_cega
  return (
    <div className="inventory-print">
      <header className="inventory-print-header">
        <img src="/logo.jpg" alt="Aura Semijoias" />
        <div>
          <h1>{mode === 'MANUAL' ? 'Conferência Física de Inventário' : 'Resultado da Conferência de Inventário'}</h1>
          <p>{inventario.titulo}</p>
        </div>
      </header>

      <div className="inventory-print-meta">
        <span><strong>Emissão:</strong> {new Date().toLocaleString('pt-BR')}</span>
        <span><strong>Iniciado por:</strong> {inventario.criado_por_nome}</span>
        <span><strong>Referência:</strong> {formatDateTime(inventario.iniciado_em)}</span>
        <span><strong>Modo:</strong> {inventario.contagem_cega ? 'Contagem cega' : 'Contagem aberta'}</span>
      </div>
      {inventario.observacoes && <p className="inventory-print-notes"><strong>Observações:</strong> {inventario.observacoes}</p>}

      <table>
        <thead>
          <tr>
            <th className="print-check">OK</th>
            <th>Código / referência</th>
            <th>Produto</th>
            <th>Categoria</th>
            {mostrarSistema && <th className="print-number">Sistema</th>}
            <th className="print-number">Físico</th>
            <th className="print-number">Dif.</th>
            <th>Observação</th>
          </tr>
        </thead>
        <tbody>
          {itens.map(item => (
            <tr key={item.id}>
              <td className="print-check">□</td>
              <td>{item.codigo_peca || '-'}{item.referencia ? ` / ${item.referencia}` : ''}</td>
              <td>{item.nome}</td>
              <td>{item.categoria || '-'}</td>
              {mostrarSistema && <td className="print-number">{item.quantidade_sistema}</td>}
              <td className="print-number">{mode === 'RESULTADO' ? item.quantidade_fisica ?? '-' : ''}</td>
              <td className="print-number">{mode === 'RESULTADO' ? item.diferenca ?? '-' : ''}</td>
              <td>{mode === 'RESULTADO' ? item.observacoes || '' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inventory-print-summary">
        <span><strong>Produtos:</strong> {resumo.total}</span>
        <span><strong>Unidades no sistema:</strong> {resumo.unidadesSistema}</span>
        {mode === 'RESULTADO' && <span><strong>Unidades físicas:</strong> {resumo.unidadesFisicas}</span>}
        {mode === 'RESULTADO' && <span><strong>Divergências:</strong> {resumo.divergentes}</span>}
      </div>
      <div className="inventory-print-signatures">
        <span>Responsável pela contagem</span>
        <span>Responsável pela validação</span>
      </div>
    </div>
  )
}
