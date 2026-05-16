import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit, canDelete } from '../lib/permissions'
import { Search, Plus, Pencil, Trash2, X, Check } from 'lucide-react'
import { useEffect, useState } from 'react'

type Produto = {
  id: string
  codigo_peca: string
  referencia: string
  nome: string
  categoria: string
  quantidade: number
  preco_custo: number
  percentual_lucro: number
  valor_venda: number
  lucro_unitario: number
  lucro_total: number
  status: string
}

type FormData = {
  codigo_peca: string
  referencia: string
  nome: string
  categoria: string
  quantidade: number
  preco_custo: string
  percentual_lucro: string
  valor_venda: string
}

const emptyForm: FormData = {
  codigo_peca: '',
  referencia: '',
  nome: '',
  categoria: '',
  quantidade: 0,
  preco_custo: '',
  percentual_lucro: '1.00',
  valor_venda: '',
}

const statusList = ['TODOS', 'EM_ESTOQUE', 'BAIXA_NO_ESTOQUE', 'ESGOTADO']

const statusColor: Record<string, string> = {
  EM_ESTOQUE: 'bg-green-100 text-green-800',
  BAIXA_NO_ESTOQUE: 'bg-yellow-100 text-yellow-800',
  ESGOTADO: 'bg-red-100 text-red-800',
}

const statusLabel: Record<string, string> = {
  EM_ESTOQUE: 'Em Estoque',
  BAIXA_NO_ESTOQUE: 'Baixa no Estoque',
  ESGOTADO: 'Esgotado',
}

export function Produtos() {
  const { user } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState('TODOS')

  useEffect(() => { fetchProdutos(); fetchCategorias() }, [])

  async function fetchCategorias() {
    const { data } = await supabase.from('categorias').select('nome').order('nome')
    if (data) setCategorias(data.map(c => c.nome))
  }

  async function fetchProdutos() {
    setLoading(true)
    const { data } = await supabase.from('produtos').select('*').order('criado_em', { ascending: false })
    if (data) setProdutos(data)
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(p: Produto) {
    setForm({
      codigo_peca: p.codigo_peca || '',
      referencia: p.referencia || '',
      nome: p.nome || '',
      categoria: p.categoria,
      quantidade: p.quantidade,
      preco_custo: String(p.preco_custo),
      percentual_lucro: String(p.percentual_lucro),
      valor_venda: String(p.valor_venda ?? ''),
    })
    setEditingId(p.id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome) return
    setSaving(true)
    const preco_custo = Number(form.preco_custo) || 0
    const percentual_lucro = Number(form.percentual_lucro) || 1.00
    const valor_venda = Number(form.valor_venda) || (preco_custo * (1 + percentual_lucro))
    const valor_venda_r = Math.round(valor_venda * 100) / 100
    const lucro_unitario = Math.round((valor_venda_r - preco_custo) * 100) / 100
    const payload = {
      codigo_peca: form.codigo_peca || null,
      referencia: form.referencia || null,
      nome: form.nome,
      categoria: form.categoria,
      quantidade: Number(form.quantidade),
      preco_custo,
      percentual_lucro,
      valor_venda: valor_venda_r,
      lucro_unitario,
      lucro_total: Math.round(lucro_unitario * Number(form.quantidade) * 100) / 100,
    }
    let error
    if (editingId) {
      ({ error } = await supabase.from('produtos').update(payload).eq('id', editingId))
    } else {
      ({ error } = await supabase.from('produtos').insert(payload))
    }
    setSaving(false)
    if (error) {
      alert(`Erro ao salvar: ${error.message}`)
      return
    }
    setModalOpen(false)
    fetchProdutos()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este produto?')) return
    await supabase.from('produtos').delete().eq('id', id)
    fetchProdutos()
  }

  const filtered = produtos.filter(p => {
    const matchSearch = !search || p.nome?.toLowerCase().includes(search.toLowerCase()) || p.codigo_peca?.toLowerCase().includes(search.toLowerCase())
    const matchCat = filterCat === 'TODOS' || p.categoria === filterCat
    const matchStatus = filterStatus === 'TODOS' || p.status === filterStatus
    return matchSearch && matchCat && matchStatus
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-6 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-stone-900">Estoque de Produtos</h3>
          {canEdit(user?.perfil) && (
            <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          )}
        </div>

        <div className="p-4 border-b border-stone-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou código..." className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categorias.map(c => (
              <button key={c} onClick={() => setFilterCat(c === filterCat ? 'TODOS' : c)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterCat === c ? 'bg-brand-600 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusList.map(s => (
              <button key={s} onClick={() => setFilterStatus(s === filterStatus ? 'TODOS' : s)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filterStatus === s ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>{s === 'TODOS' ? 'Todos' : statusLabel[s]}</button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-stone-400 m-6 border border-dashed rounded-lg border-stone-300">Nenhum produto encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-500 uppercase font-semibold">
                  <th className="text-left px-4 py-3">Código</th>
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-right px-4 py-3">Qtd</th>
                  <th className="text-right px-4 py-3">Custo</th>
                  <th className="text-right px-4 py-3">Venda</th>
                  <th className="text-right px-4 py-3">Lucro Unit.</th>
                  <th className="text-center px-4 py-3">Status</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-stone-500">{p.codigo_peca || '-'}</td>
                    <td className="px-4 py-3 font-medium text-stone-900">{p.nome}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-stone-100 px-2 py-0.5 rounded-full text-stone-600">{p.categoria}</span></td>
                    <td className="px-4 py-3 text-right font-medium">{p.quantidade}</td>
                    <td className="px-4 py-3 text-right">{Number(p.preco_custo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>

                    <td className="px-4 py-3 text-right font-medium">{Number(p.valor_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>

                    <td className="px-4 py-3 text-right text-green-600 font-medium">{Number(p.lucro_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-4 py-3 text-center"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[p.status] || 'bg-stone-100 text-stone-600'}`}>{statusLabel[p.status] || p.status}</span></td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {canEdit(user?.perfil) && <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-stone-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"><Pencil className="w-4 h-4" /></button>}
                        {canDelete(user?.perfil) && <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                    </td>
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
              <h4 className="text-lg font-bold text-stone-900">{editingId ? 'Editar' : 'Novo'} Produto</h4>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Código da Peça</label>
                  <input value={form.codigo_peca} onChange={e => setForm({ ...form, codigo_peca: e.target.value })} placeholder="Ex: A-001" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Referência</label>
                  <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} placeholder="Ex: REF-001" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Nome do Produto *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do produto" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Categoria</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white">
                    {categorias.length === 0 && <option value="">Carregando...</option>}
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Quantidade</label>
                  <input type="number" min="0" value={form.quantidade} onChange={e => setForm({ ...form, quantidade: Number(e.target.value) })} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Preço de Custo (R$)</label>
                  <input type="number" step="0.01" min="0" value={form.preco_custo} onChange={e => {
                    const custo = e.target.value
                    const margem = Number(form.percentual_lucro || 1.00)
                    const venda = custo ? Math.round(Number(custo) * (1 + margem) * 100) / 100 : ''
                    setForm({ ...form, preco_custo: custo, valor_venda: venda === '' ? '' : String(venda) })
                  }} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">% Lucro (ex: 1.00 = 100%)</label>
                  <input type="number" step="0.01" min="0" value={form.percentual_lucro} onChange={e => {
                    const margem = e.target.value
                    const custo = Number(form.preco_custo || 0)
                    const venda = custo ? Math.round(custo * (1 + Number(margem || 1.00)) * 100) / 100 : ''
                    setForm({ ...form, percentual_lucro: margem, valor_venda: venda === '' ? '' : String(venda) })
                  }} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Valor de Venda (R$) <span className="text-stone-400 font-normal">— digite diretamente para arredondar</span></label>
                <input type="number" step="0.01" min="0" value={form.valor_venda} onChange={e => {
                  const venda = e.target.value
                  const custo = Number(form.preco_custo || 0)
                  const margem = custo > 0 && venda ? String(Math.round(((Number(venda) / custo) - 1) * 10000) / 10000) : form.percentual_lucro
                  setForm({ ...form, valor_venda: venda, percentual_lucro: margem })
                }} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nome} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> {editingId ? 'Atualizar' : 'Salvar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
