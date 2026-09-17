import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit } from '../lib/permissions'
import { Plus, X, Check, ArrowUpCircle, ArrowDownCircle, Search, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type Movimentacao = {
  id: string
  data: string
  produto_id: string
  tipo: 'ENTRADA' | 'SAIDA'
  quantidade: number
  responsavel: string
  observacoes: string
  criado_em: string
  produtos?: { nome: string; codigo_peca: string }
}

type Produto = { id: string; nome: string; codigo_peca: string; referencia: string; quantidade: number }

type BatchItem = { key: string; produtoId: string; quantidade: number }

export function Movimentacoes() {
  const { user } = useAuth()
  const [movs, setMovs] = useState<Movimentacao[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [data, setData] = useState(new Date().toISOString().split('T')[0])
  const [produtoId, setProdutoId] = useState('')
  const [tipo, setTipo] = useState<'ENTRADA' | 'SAIDA'>('ENTRADA')
  const [quantidade, setQuantidade] = useState(1)
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [batchOpen, setBatchOpen] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)
  const [batchData, setBatchData] = useState(new Date().toISOString().split('T')[0])
  const [batchResponsavel, setBatchResponsavel] = useState('')
  const [batchObservacoes, setBatchObservacoes] = useState('')
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchSearch, setBatchSearch] = useState('')
  const [batchShowResults, setBatchShowResults] = useState(false)
  const [batchHighlight, setBatchHighlight] = useState(-1)

  useEffect(() => { fetchMovs() }, [])

  async function fetchMovs() {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      supabase.from('movimentacoes').select('*, produtos(nome, codigo_peca)').order('criado_em', { ascending: false }),
      supabase.from('produtos').select('id, nome, codigo_peca, referencia, quantidade').order('nome'),
    ])
    if (mRes.data) setMovs(mRes.data)
    if (pRes.data) setProdutos(pRes.data)
    setLoading(false)
  }

  function openNew() {
    setData(new Date().toISOString().split('T')[0])
    setProdutoId('')
    setTipo('ENTRADA')
    setQuantidade(1)
    setResponsavel('')
    setObservacoes('')
    setModalOpen(true)
  }

  function openBatch() {
    setBatchData(new Date().toISOString().split('T')[0])
    setBatchResponsavel('')
    setBatchObservacoes('')
    setBatchItems([])
    setBatchSearch('')
    setBatchShowResults(false)
    setBatchHighlight(-1)
    setBatchOpen(true)
  }

  function addBatchProduct(prodId: string) {
    const prod = produtos.find(p => p.id === prodId)
    if (!prod) return
    const existing = batchItems.findIndex(i => i.produtoId === prodId)
    if (existing >= 0) {
      setBatchItems(batchItems.map((item, idx) => idx === existing
        ? { ...item, quantidade: Math.min(item.quantidade + 1, prod.quantidade) }
        : item))
    } else {
      setBatchItems([...batchItems, { key: crypto.randomUUID(), produtoId: prodId, quantidade: 1 }])
    }
    setBatchSearch('')
    setBatchShowResults(false)
    setBatchHighlight(-1)
  }

  function updateBatchQty(key: string, quantidade: number) {
    setBatchItems(batchItems.map(item => item.key === key ? { ...item, quantidade } : item))
  }

  function removeBatchItem(key: string) {
    setBatchItems(batchItems.filter(item => item.key !== key))
  }

  async function handleSaveBatch() {
    if (!canSaveBatch) return
    setBatchSaving(true)
    const { error } = await supabase.rpc('registrar_movimentacoes_lote', {
      p_data: batchData,
      p_tipo: 'SAIDA',
      p_responsavel: batchResponsavel || null,
      p_observacoes: batchObservacoes || null,
      p_itens: batchItems.map(item => ({ produto_id: item.produtoId, quantidade: item.quantidade })),
    })
    if (error) {
      alert('Erro ao registrar saída em lote: ' + (error.message || 'operação não concluída'))
      setBatchSaving(false)
      return
    }
    setBatchSaving(false)
    setBatchOpen(false)
    fetchMovs()
  }

  async function handleSave() {
    if (!produtoId || quantidade < 1) return

    setSaving(true)
    const { error } = await supabase.rpc('registrar_movimentacao', {
      p_data: data,
      p_produto_id: produtoId,
      p_tipo: tipo,
      p_quantidade: quantidade,
      p_responsavel: responsavel || null,
      p_observacoes: observacoes || null,
    })
    if (error) {
      alert('Erro ao registrar movimentação: ' + (error.message || 'operação não concluída'))
      setSaving(false)
      return
    }
    setSaving(false)
    setModalOpen(false)
    fetchMovs()
  }

  const filtered = movs.filter(m => {
    if (!search) return true
    const nome = m.produtos?.nome?.toLowerCase() || ''
    const cod = m.produtos?.codigo_peca?.toLowerCase() || ''
    return nome.includes(search.toLowerCase()) || cod.includes(search.toLowerCase()) || m.tipo.includes(search.toUpperCase())
  })

  const batchSelectedIds = new Set(batchItems.map(item => item.produtoId))
  const batchResults = batchSearch.trim()
    ? produtos.filter(p =>
        p.quantidade > 0 &&
        !batchSelectedIds.has(p.id) &&
        (p.nome.toLowerCase().includes(batchSearch.toLowerCase()) ||
         p.codigo_peca?.toLowerCase().includes(batchSearch.toLowerCase()) ||
         p.referencia?.toLowerCase().includes(batchSearch.toLowerCase()))
      ).slice(0, 12)
    : []
  const batchItemError = (item: BatchItem) => {
    const prod = produtos.find(p => p.id === item.produtoId)
    if (!prod) return 'Produto não encontrado'
    if (item.quantidade < 1) return 'Quantidade deve ser maior que zero'
    if (item.quantidade > prod.quantidade) return `Estoque insuficiente. Disponível: ${prod.quantidade}`
    return null
  }
  const canSaveBatch = batchItems.length > 0 && !batchItems.some(item => batchItemError(item) !== null) && !batchSaving

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-6 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-stone-900">Movimentações de Estoque</h3>
          {canEdit(user?.perfil) && (
            <div className="flex flex-wrap gap-2">
              <button onClick={openBatch} className="px-4 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                <ArrowDownCircle className="w-4 h-4" /> Saída em Lote
              </button>
              <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Nova Movimentação
              </button>
            </div>
          )}
        </div>

        <div className="p-4 border-b border-stone-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por produto, código ou tipo..." className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 m-6 border border-dashed rounded-lg border-stone-300">Nenhuma movimentação encontrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-500 uppercase font-semibold">
                  <th className="text-left px-4 py-3">Data</th>
                  <th className="text-left px-4 py-3">Produto</th>
                  <th className="text-left px-4 py-3">Tipo</th>
                  <th className="text-right px-4 py-3">Quantidade</th>
                  <th className="text-left px-4 py-3">Responsável</th>
                  <th className="text-left px-4 py-3">Observações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 text-stone-500 font-mono text-xs">{new Date(m.data).toLocaleDateString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-stone-900">{m.produtos?.codigo_peca ? `${m.produtos.codigo_peca} - ` : ''}{m.produtos?.nome || 'Produto removido'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${m.tipo === 'ENTRADA' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {m.tipo === 'ENTRADA' ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}
                        {m.tipo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{m.quantidade}</td>
                    <td className="px-4 py-3 text-stone-600">{m.responsavel || '-'}</td>
                    <td className="px-4 py-3 text-stone-500 max-w-[200px] truncate">{m.observacoes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-stone-900">Nova Movimentação</h4>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Data</label>
                  <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Tipo *</label>
                  <div className="flex gap-2">
                    <button onClick={() => setTipo('ENTRADA')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${tipo === 'ENTRADA' ? 'bg-green-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}><ArrowUpCircle className="w-4 h-4" /> Entrada</button>
                    <button onClick={() => setTipo('SAIDA')} className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 ${tipo === 'SAIDA' ? 'bg-red-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}><ArrowDownCircle className="w-4 h-4" /> Saída</button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Produto *</label>
                <select value={produtoId} onChange={e => setProdutoId(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white">
                  <option value="">Selecione um produto...</option>
                  {produtos.map(p => <option key={p.id} value={p.id}>{p.codigo_peca || ''} - {p.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Quantidade *</label>
                  <input type="number" min="1" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Responsável</label>
                  <input value={responsavel} onChange={e => setResponsavel(e.target.value)} placeholder="Quem registrou" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Motivo da movimentação..." className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !produtoId || quantidade < 1} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> Registrar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {batchOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setBatchOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-lg font-bold text-stone-900">Saída em Lote</h4>
                  <p className="text-xs text-stone-500 mt-0.5">Dê baixa em vários produtos em um único lançamento.</p>
                </div>
                <button onClick={() => setBatchOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Data</label>
                  <input type="date" value={batchData} onChange={e => setBatchData(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Responsável</label>
                  <input value={batchResponsavel} onChange={e => setBatchResponsavel(e.target.value)} placeholder="Quem registrou" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Adicionar produto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    value={batchSearch}
                    onChange={e => { setBatchSearch(e.target.value); setBatchShowResults(true); setBatchHighlight(-1) }}
                    onFocus={() => setBatchShowResults(true)}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setBatchHighlight(i => Math.min(i + 1, batchResults.length - 1)) }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setBatchHighlight(i => Math.max(i - 1, 0)) }
                      else if (e.key === 'Enter' && batchHighlight >= 0 && batchResults[batchHighlight]) { e.preventDefault(); addBatchProduct(batchResults[batchHighlight].id) }
                      else if (e.key === 'Escape') setBatchShowResults(false)
                    }}
                    placeholder="Buscar por nome, código ou referência..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                  />
                  {batchShowResults && batchSearch.trim() && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {batchResults.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-stone-400">Nenhum produto com estoque encontrado.</div>
                      ) : (
                        batchResults.map((p, i) => (
                          <button key={p.id} onMouseEnter={() => setBatchHighlight(i)} onClick={() => addBatchProduct(p.id)} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-brand-50 transition-colors ${i === batchHighlight ? 'bg-brand-50' : ''}`}>
                            <span className="font-medium text-stone-900">{p.codigo_peca || '---'}</span>
                            <span className="text-stone-600 truncate">{p.nome}</span>
                            <span className="ml-auto text-xs text-stone-400 shrink-0">estoque: {p.quantidade}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Itens da saída ({batchItems.length})</label>
                {batchItems.length === 0 ? (
                  <div className="text-center py-8 text-sm text-stone-400 border border-dashed border-stone-300 rounded-lg">Nenhum produto adicionado.</div>
                ) : (
                  <div className="border border-stone-200 rounded-lg divide-y divide-stone-100">
                    {batchItems.map(item => {
                      const prod = produtos.find(p => p.id === item.produtoId)
                      const erro = batchItemError(item)
                      return (
                        <div key={item.key} className="px-3 py-2.5 space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-stone-900 truncate">{prod?.codigo_peca ? `${prod.codigo_peca} - ` : ''}{prod?.nome || 'Produto removido'}</div>
                              <div className="text-xs text-stone-500">Estoque disponível: {prod?.quantidade ?? 0}</div>
                            </div>
                            <input type="number" min="1" max={prod?.quantidade || 1} value={item.quantidade} onChange={e => updateBatchQty(item.key, Number(e.target.value))} className={`w-20 px-3 py-2 text-sm text-right border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 ${erro ? 'border-red-300' : 'border-stone-200 focus:border-brand-500'}`} />
                            <button onClick={() => removeBatchItem(item.key)} className="text-red-400 hover:text-red-600 p-1" title="Remover item"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          {erro && <p className="text-xs text-red-600">{erro}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Observações</label>
                <textarea value={batchObservacoes} onChange={e => setBatchObservacoes(e.target.value)} rows={2} placeholder="Motivo da saída..." className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3 pt-4 border-t border-stone-100">
              <button onClick={() => setBatchOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleSaveBatch} disabled={!canSaveBatch} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {batchSaving ? 'Registrando...' : <><Check className="w-4 h-4" /> {batchItems.length === 0 ? 'Registrar saídas' : batchItems.length === 1 ? 'Registrar 1 saída' : `Registrar ${batchItems.length} saídas`}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
