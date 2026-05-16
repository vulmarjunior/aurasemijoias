import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit, canDelete } from '../lib/permissions'
import { Plus, Pencil, Trash2, X, Check, Tag } from 'lucide-react'
import { useEffect, useState } from 'react'

type Categoria = {
  id: string
  nome: string
  total_produtos?: number
}

export function Categorias() {
  const { user } = useAuth()
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)
  const [totalProdutos, setTotalProdutos] = useState<Record<string, number>>({})

  useEffect(() => { fetchCategorias() }, [])

  async function fetchCategorias() {
    setLoading(true)
    const { data } = await supabase.from('categorias').select('*').order('nome', { ascending: true })
    if (data) {
      setCategorias(data)
      const counts: Record<string, number> = {}
      for (const cat of data) {
        const { count } = await supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('categoria', cat.nome)
        counts[cat.id] = count || 0
      }
      setTotalProdutos(counts)
    }
    setLoading(false)
  }

  function openNew() { setEditingId(null); setNome(''); setModalOpen(true) }

  function openEdit(c: Categoria) { setEditingId(c.id); setNome(c.nome); setModalOpen(true) }

  async function handleSave() {
    const nomeTrim = nome.trim().toUpperCase()
    if (!nomeTrim) return
    setSaving(true)
    if (editingId) {
      await supabase.from('categorias').update({ nome: nomeTrim }).eq('id', editingId)
    } else {
      await supabase.from('categorias').insert({ nome: nomeTrim })
    }
    setSaving(false); setModalOpen(false); fetchCategorias()
  }

  async function handleDelete(c: Categoria) {
    const count = totalProdutos[c.id] || 0
    if (count > 0) { alert(`Não é possível excluir "${c.nome}". ${count} produto${count > 1 ? 's' : ''} usa(m) esta categoria.`); return }
    if (!confirm(`Excluir categoria "${c.nome}"?`)) return
    await supabase.from('categorias').delete().eq('id', c.id)
    fetchCategorias()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-6 border-b border-stone-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-stone-900">Categorias de Semijoias</h3>
          {canEdit(user?.perfil) && (
            <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Nova Categoria
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Carregando...</div>
        ) : categorias.length === 0 ? (
          <div className="text-center py-12 text-stone-400 m-6 border border-dashed rounded-lg border-stone-300">Nenhuma categoria cadastrada.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 text-xs text-stone-500 uppercase font-semibold">
                  <th className="text-left px-4 py-3">Categoria</th>
                  <th className="text-center px-4 py-3">Produtos</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(c => (
                  <tr key={c.id} className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-stone-400" />
                        <span className="font-medium text-stone-900">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-stone-600">{totalProdutos[c.id] || 0}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {canEdit(user?.perfil) && <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-stone-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"><Pencil className="w-4 h-4" /></button>}
                        {canDelete(user?.perfil) && <button onClick={() => handleDelete(c)} className="p-1.5 rounded-md text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-stone-900">{editingId ? 'Editar' : 'Nova'} Categoria</h4>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Nome *</label>
              <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: PINGENTE" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 uppercase" />
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !nome.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> {editingId ? 'Atualizar' : 'Salvar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
