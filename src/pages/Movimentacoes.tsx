import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit } from '../lib/permissions'
import { Plus, X, Check, ArrowUpCircle, ArrowDownCircle, Search } from 'lucide-react'
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

type Produto = { id: string; nome: string; codigo_peca: string }

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

  useEffect(() => { fetchMovs() }, [])

  async function fetchMovs() {
    setLoading(true)
    const [mRes, pRes] = await Promise.all([
      supabase.from('movimentacoes').select('*, produtos(nome, codigo_peca)').order('criado_em', { ascending: false }),
      supabase.from('produtos').select('id, nome, codigo_peca').order('nome'),
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

  async function handleSave() {
    if (!produtoId || quantidade < 1) return

    if (tipo === 'SAIDA') {
      const { data: prod } = await supabase.from('produtos').select('quantidade').eq('id', produtoId).single()
      if (prod && prod.quantidade < quantidade) {
        alert(`Estoque insuficiente! Disponível: ${prod.quantidade}`)
        return
      }
    }

    setSaving(true)
    const { error } = await supabase.from('movimentacoes').insert({
      data,
      produto_id: produtoId,
      tipo,
      quantidade,
      responsavel: responsavel || null,
      observacoes: observacoes || null,
    })
    if (error) { alert('Erro ao registrar movimentação'); setSaving(false); return }
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-6 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-stone-900">Movimentações de Estoque</h3>
          {canEdit(user?.perfil) && (
            <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nova Movimentação
            </button>
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
    </div>
  )
}
