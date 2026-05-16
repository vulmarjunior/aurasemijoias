import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit, canDelete } from '../lib/permissions'
import { Search, Plus, Pencil, Trash2, X, Check, Phone, Instagram } from 'lucide-react'
import { useEffect, useState } from 'react'

type Cliente = {
  id: string
  nome: string
  telefone: string
  instagram: string
  observacoes: string
  criado_em: string
}

type FormData = {
  nome: string
  telefone: string
  instagram: string
  observacoes: string
}

const emptyForm: FormData = { nome: '', telefone: '', instagram: '', observacoes: '' }

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function Clientes() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => { fetchClientes() }, [])

  async function fetchClientes() {
    setLoading(true)
    const { data } = await supabase.from('clientes').select('*').order('nome', { ascending: true })
    if (data) setClientes(data)
    setLoading(false)
  }

  function openNew() {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  function openEdit(c: Cliente) {
    setForm({ nome: c.nome, telefone: c.telefone || '', instagram: c.instagram || '', observacoes: c.observacoes || '' })
    setEditingId(c.id)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome) return
    setSaving(true)
    const payload = {
      nome: form.nome,
      telefone: form.telefone || null,
      instagram: form.instagram || null,
      observacoes: form.observacoes || null,
    }
    if (editingId) {
      await supabase.from('clientes').update(payload).eq('id', editingId)
    } else {
      await supabase.from('clientes').insert(payload)
    }
    setSaving(false)
    setModalOpen(false)
    fetchClientes()
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    fetchClientes()
  }

  const filtered = clientes.filter(c => !search || c.nome?.toLowerCase().includes(search.toLowerCase()) || c.telefone?.includes(search) || c.instagram?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-slate-900">Clientes</h3>
          {canEdit(user?.perfil) && (
            <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Novo Cliente
            </button>
          )}
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou Instagram..." className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 m-6 border border-dashed rounded-lg border-slate-300">Nenhum cliente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase font-semibold">
                  <th className="text-left px-4 py-3">Nome</th>
                  <th className="text-left px-4 py-3">Telefone</th>
                  <th className="text-left px-4 py-3">Instagram</th>
                  <th className="text-left px-4 py-3">Observações</th>
                  <th className="text-center px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{c.nome}</td>
                    <td className="px-4 py-3">
                      {c.telefone ? (
                        <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`} target="_blank" className="flex items-center gap-1.5 text-slate-600 hover:text-green-600 transition-colors">
                          <Phone className="w-3.5 h-3.5" /> {c.telefone}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {c.instagram ? (
                        <a href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" className="flex items-center gap-1.5 text-slate-600 hover:text-pink-600 transition-colors">
                          <Instagram className="w-3.5 h-3.5" /> @{c.instagram.replace('@', '')}
                        </a>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{c.observacoes || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        {canEdit(user?.perfil) && <button onClick={() => openEdit(c)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil className="w-4 h-4" /></button>}
                        {canDelete(user?.perfil) && <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>}
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
              <h4 className="text-lg font-bold text-slate-900">{editingId ? 'Editar' : 'Novo'} Cliente</h4>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome *</label>
                <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Nome do cliente" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm({ ...form, telefone: maskPhone(e.target.value) })} placeholder="(11) 99999-9999" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Instagram</label>
                  <input value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="@usuario" className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Observações</label>
                <textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} rows={3} placeholder="Anotações sobre o cliente..." className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !form.nome} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> {editingId ? 'Atualizar' : 'Salvar'}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
