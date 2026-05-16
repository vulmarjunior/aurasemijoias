import { useAuth } from '../lib/AuthContext'
import { canManageUsers, canEdit, canDelete } from '../lib/permissions'
import { supabase } from '../lib/supabase'
import { User, Shield, Users, Check, X, Plus, AlertCircle, Key, Tag, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

type PerfilUser = {
  id: string
  nome: string
  email: string
  perfil: string
  ativo: boolean
}

export function Configuracoes() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState<'perfil' | 'usuarios' | 'categorias'>('perfil')
  const [users, setUsers] = useState<PerfilUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newNome, setNewNome] = useState('')
  const [newPerfil, setNewPerfil] = useState('USER')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'success' | 'error'>('success')
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdOld, setPwdOld] = useState('')
  const [pwdNew, setPwdNew] = useState('')

  useEffect(() => {
    if (tab === 'usuarios' && canManageUsers(user?.perfil)) fetchUsers()
  }, [tab, user])

  function showMsg(text: string, type: 'success' | 'error' = 'success') {
    setMsg(text)
    setMsgType(type)
    setTimeout(() => setMsg(''), 4000)
  }

  async function fetchUsers() {
    setLoadingUsers(true)
    const { data } = await supabase.from('perfis').select('*').order('nome')
    if (data) setUsers(data)
    setLoadingUsers(false)
  }

  async function handleToggleAtivo(u: PerfilUser) {
    if (u.id === user?.id) { showMsg('Você não pode desativar seu próprio perfil', 'error'); return }
    await supabase.from('perfis').update({ ativo: !u.ativo }).eq('id', u.id)
    showMsg(`Usuário ${u.ativo ? 'desativado' : 'ativado'}`)
    fetchUsers()
  }

  async function handleChangePerfil(u: PerfilUser, novo: string) {
    if (u.id === user?.id) { showMsg('Você não pode alterar seu próprio perfil', 'error'); return }
    await supabase.from('perfis').update({ perfil: novo }).eq('id', u.id)
    showMsg(`Perfil de ${u.nome} alterado para ${novo}`)
    fetchUsers()
  }

  async function handleCreateUser() {
    if (!newEmail || !newPassword || !newNome) return
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ email: newEmail, password: newPassword, nome: newNome, perfil: newPerfil }),
      })
      const json = await res.json()
      if (!res.ok) { showMsg(json.error || 'Erro ao criar usuário', 'error'); setSaving(false); return }
      showMsg(`Usuário ${newNome} criado com sucesso!`)
      setNewEmail(''); setNewPassword(''); setNewNome(''); setNewPerfil('USER')
      setNewUserOpen(false)
      fetchUsers()
    } catch {
      showMsg('Erro de conexão com o servidor', 'error')
    }
    setSaving(false)
  }

  async function handleChangePassword() {
    if (!pwdOld || !pwdNew) return
    setSaving(true)
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user!.email, password: pwdOld })
    if (signInErr) { showMsg('Senha atual incorreta', 'error'); setSaving(false); return }
    const { error } = await supabase.auth.updateUser({ password: pwdNew })
    if (error) { showMsg(error.message, 'error') } else { showMsg('Senha alterada com sucesso!'); setPwdOld(''); setPwdNew(''); setChangingPwd(false) }
    setSaving(false)
  }

  if (!user) return null

  const tabs = [
    { key: 'perfil', label: 'Meu Perfil', icon: User },
    ...(canManageUsers(user.perfil) ? [{ key: 'usuarios', label: 'Usuários', icon: Users }] : []),
    { key: 'categorias', label: 'Categorias', icon: Tag },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="border-b border-stone-100">
          <div className="flex">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setTab(t.key as 'perfil' | 'usuarios' | 'categorias')} className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-stone-500 hover:text-stone-700'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <div className={`mx-4 mt-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${msgType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msgType === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {msg}
          </div>
        )}

        <div className="p-6">
          {tab === 'perfil' && (
            <div className="space-y-6 max-w-lg">
              <div className="flex items-center gap-4 pb-4 border-b border-stone-100">
                <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
                  <User className="w-7 h-7 text-brand-600" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900">{user.nome}</h4>
                  <p className="text-sm text-stone-500">{user.email}</p>
                  <span className="inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">{user.perfil}</span>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-semibold text-stone-900 mb-2">Alterar Senha</h5>
                {!changingPwd ? (
                  <button onClick={() => setChangingPwd(true)} className="px-4 py-2 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors flex items-center gap-2">
                    <Key className="w-4 h-4" /> Alterar Senha
                  </button>
                ) : (
                  <div className="space-y-3 bg-stone-50 p-4 rounded-lg">
                    <input type="password" value={pwdOld} onChange={e => setPwdOld(e.target.value)} placeholder="Senha atual" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                    <input type="password" value={pwdNew} onChange={e => setPwdNew(e.target.value)} placeholder="Nova senha" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                    <div className="flex gap-2">
                      <button onClick={() => setChangingPwd(false)} className="px-3 py-2 text-sm text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
                      <button onClick={handleChangePassword} disabled={saving || !pwdOld || !pwdNew} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors">{saving ? 'Alterando...' : 'Alterar'}</button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-stone-100">
                <button onClick={signOut} className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">Sair do Sistema</button>
              </div>
            </div>
          )}

          {tab === 'usuarios' && canManageUsers(user.perfil) && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-stone-500">{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
                <button onClick={() => setNewUserOpen(true)} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                  <Plus className="w-4 h-4" /> Novo Usuário
                </button>
              </div>

              {newUserOpen && (
                <div className="bg-stone-50 rounded-lg p-4 space-y-3 border border-stone-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Nome</label>
                      <input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome completo" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Perfil</label>
                      <select value={newPerfil} onChange={e => setNewPerfil(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white">
                        <option value="ADMIN">ADMIN</option>
                        <option value="USER">USER</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Email</label>
                      <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@provedor.com" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-500 mb-1">Senha</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Senha inicial" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setNewUserOpen(false)} className="px-3 py-2 text-sm text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
                    <button onClick={handleCreateUser} disabled={saving || !newNome || !newEmail || !newPassword} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors">{saving ? 'Criando...' : 'Criar Usuário'}</button>
                  </div>
                </div>
              )}

              {loadingUsers ? (
                <div className="text-center py-8 text-stone-400">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-stone-500 uppercase font-semibold border-b border-stone-100">
                        <th className="text-left px-3 py-2">Nome</th>
                        <th className="text-left px-3 py-2">Email</th>
                        <th className="text-center px-3 py-2">Perfil</th>
                        <th className="text-center px-3 py-2">Ativo</th>
                        <th className="text-center px-3 py-2">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className={`border-b border-stone-50 ${!u.ativo ? 'text-stone-300' : ''}`}>
                          <td className="px-3 py-2.5 font-medium">{u.nome}{u.id === user.id && <span className="text-[10px] text-brand-600 ml-1">(você)</span>}</td>
                          <td className="px-3 py-2.5 text-stone-500">{u.email}</td>
                          <td className="px-3 py-2.5 text-center">
                            {u.id !== user.id ? (
                              <select value={u.perfil} onChange={e => handleChangePerfil(u, e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30">
                                <option value="ADMIN">ADMIN</option>
                                <option value="USER">USER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                            ) : (
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-stone-100">{u.perfil}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.ativo ? 'text-green-600' : 'text-red-500'}`}>
                              {u.ativo ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                              {u.ativo ? 'Sim' : 'Não'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {u.id !== user.id && (
                              <button onClick={() => handleToggleAtivo(u)} className="px-2 py-1 text-xs font-medium border border-stone-200 rounded hover:bg-stone-50 transition-colors">
                                {u.ativo ? 'Desativar' : 'Ativar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'categorias' && <CategoriasTab />}
        </div>
      </div>
    </div>
  )
}

function CategoriasTab() {
  const { user } = useAuth()
  const [categorias, setCategorias] = useState<{ id: string; nome: string; total: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const { data: cats } = await supabase.from('categorias').select('*').order('nome')
    if (cats) {
      const withTotals = await Promise.all(cats.map(async (c) => {
        const { count } = await supabase.from('produtos').select('*', { count: 'exact', head: true }).eq('categoria', c.nome)
        return { ...c, total: count || 0 }
      }))
      setCategorias(withTotals)
    }
    setLoading(false)
  }

  function openNew() { setEditingId(null); setNome(''); setModalOpen(true) }
  function openEdit(c: { id: string; nome: string }) { setEditingId(c.id); setNome(c.nome); setModalOpen(true) }

  async function handleSave() {
    const nomeTrim = nome.trim().toUpperCase()
    if (!nomeTrim) return
    setSaving(true)
    if (editingId) {
      await supabase.from('categorias').update({ nome: nomeTrim }).eq('id', editingId)
    } else {
      await supabase.from('categorias').insert({ nome: nomeTrim })
    }
    setSaving(false); setModalOpen(false); fetchAll()
  }

  async function handleDelete(c: { id: string; nome: string; total: number }) {
    if (c.total > 0) { alert(`"${c.nome}" possui ${c.total} produto(s). Remova-os antes de excluir.`); return }
    if (!confirm(`Excluir "${c.nome}"?`)) return
    await supabase.from('categorias').delete().eq('id', c.id)
    fetchAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-stone-500">{categorias.length} categorias</p>
        {canEdit(user?.perfil) && (
          <button onClick={openNew} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nova Categoria
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-stone-400">Carregando...</div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-8 text-stone-400 text-sm">Nenhuma categoria cadastrada.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 uppercase font-semibold border-b border-stone-100">
                <th className="text-left px-3 py-2">Categoria</th>
                <th className="text-center px-3 py-2">Produtos</th>
                <th className="text-center px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {categorias.map(c => (
                <tr key={c.id} className="border-b border-stone-50">
                  <td className="px-3 py-2.5 font-medium flex items-center gap-2">
                    <Tag className="w-4 h-4 text-stone-400" /> {c.nome}
                  </td>
                  <td className="px-3 py-2.5 text-center text-stone-500">{c.total}</td>
                  <td className="px-3 py-2.5 text-center">
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

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-stone-900">{editingId ? 'Editar' : 'Nova'} Categoria</h4>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Nome</label>
              <input value={nome} onChange={e => setNome(e.target.value.toUpperCase())} placeholder="Ex: PINGENTE" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
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
