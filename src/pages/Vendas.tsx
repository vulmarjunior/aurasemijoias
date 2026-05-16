import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { canEdit } from '../lib/permissions'
import { Plus, X, Check, ChevronDown, ChevronUp, Search, Percent, DollarSign } from 'lucide-react'
import { useEffect, useState } from 'react'

type Cliente = { id: string; nome: string }
type Produto = { id: string; nome: string; codigo_peca: string; referencia: string; preco_custo: number; valor_venda: number; quantidade: number }

type Venda = {
  id: string
  data_venda: string
  cliente_id: string
  forma_pagamento: string
  valor_total: number
  observacoes: string
  criado_em: string
  clientes?: { nome: string }
}

type ItemVenda = {
  id: string
  venda_id: string
  produto_id: string
  quantidade: number
  preco_venda: number
  preco_custo: number
  lucro: number
  produtos?: { nome: string; codigo_peca: string }
}

type CartItem = {
  produto_id: string
  nome: string
  quantidade: number
  preco_venda: number
  preco_custo: number
}

const formasPagamento = ['PIX', 'DINHEIRO', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'PARCELADO', 'OUTRO']

function parseDesconto(obs: string | null): { desconto: number; texto: string } {
  const match = obs?.match(/^DESC:([\d.]+)\|?(.*)/)
  if (!match) return { desconto: 0, texto: obs || '' }
  return { desconto: Number(match[1]), texto: match[2] }
}

export function Vendas() {
  const { user } = useAuth()
  const [vendas, setVendas] = useState<Venda[]>([])
  const [itensVenda, setItensVenda] = useState<Record<string, ItemVenda[]>>({})
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [dataVenda, setDataVenda] = useState(new Date().toISOString().split('T')[0])
  const [clienteId, setClienteId] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('PIX')
  const [observacoes, setObservacoes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedProdId, setSelectedProdId] = useState('')
  const [selectedQty, setSelectedQty] = useState(1)
  const [searchVenda, setSearchVenda] = useState('')

  const [descontoTipo, setDescontoTipo] = useState<'percentual' | 'fixo'>('percentual')
  const [descontoInput, setDescontoInput] = useState('')

  const [searchProd, setSearchProd] = useState('')
  const [showProdResults, setShowProdResults] = useState(false)
  const [highlightIdx, setHighlightIdx] = useState(-1)

  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [newClientNome, setNewClientNome] = useState('')
  const [newClientTelefone, setNewClientTelefone] = useState('')
  const [newClientInstagram, setNewClientInstagram] = useState('')
  const [savingClient, setSavingClient] = useState(false)

  useEffect(() => { fetchVendas(); fetchClientesProdutos() }, [])

  async function fetchVendas() {
    setLoading(true)
    const { data } = await supabase.from('vendas').select('*, clientes(nome)').order('criado_em', { ascending: false })
    if (data) setVendas(data)
    setLoading(false)
  }

  async function fetchClientesProdutos() {
    const [cRes, pRes] = await Promise.all([
      supabase.from('clientes').select('id, nome').order('nome'),
      supabase.from('produtos').select('id, nome, codigo_peca, referencia, preco_custo, valor_venda, quantidade').order('nome'),
    ])
    if (cRes.data) setClientes(cRes.data)
    if (pRes.data) setProdutos(pRes.data)
  }

  async function fetchItens(vendaId: string) {
    if (itensVenda[vendaId]) return
    const { data } = await supabase.from('itens_venda').select('*, produtos(nome, codigo_peca)').eq('venda_id', vendaId)
    if (data) setItensVenda(prev => ({ ...prev, [vendaId]: data }))
  }

  function openNew() {
    setDataVenda(new Date().toISOString().split('T')[0])
    setClienteId('')
    setFormaPagamento('PIX')
    setObservacoes('')
    setCart([])
    setSelectedProdId('')
    setSelectedQty(1)
    setSearchProd('')
    setShowProdResults(false)
    setHighlightIdx(-1)
    setDescontoTipo('percentual')
    setDescontoInput('')
    setModalOpen(true)
  }

  function addToCart() {
    if (!selectedProdId) return
    const prod = produtos.find(p => p.id === selectedProdId)
    if (!prod) return
    if (selectedQty > prod.quantidade) { alert(`Estoque insuficiente. Disponível: ${prod.quantidade}`); return }
    const existing = cart.findIndex(i => i.produto_id === selectedProdId)
    if (existing >= 0) {
      const newCart = [...cart]
      const newQty = newCart[existing].quantidade + selectedQty
      if (newQty > prod.quantidade) { alert(`Estoque insuficiente. Disponível: ${prod.quantidade}, já no carrinho: ${newCart[existing].quantidade}`); return }
      newCart[existing] = { ...newCart[existing], quantidade: newQty }
      setCart(newCart)
    } else {
      setCart([...cart, { produto_id: prod.id, nome: `${prod.codigo_peca || ''} - ${prod.nome}`, quantidade: selectedQty, preco_venda: Number(prod.valor_venda), preco_custo: Number(prod.preco_custo) }])
    }
    setSelectedProdId('')
    setSelectedQty(1)
  }

  function removeFromCart(idx: number) {
    setCart(cart.filter((_, i) => i !== idx))
  }

  async function handleQuickClient() {
    if (!newClientNome.trim()) return
    setSavingClient(true)
    const { data, error } = await supabase.from('clientes').insert({
      nome: newClientNome.trim(),
      telefone: newClientTelefone.trim() || null,
      instagram: newClientInstagram.trim() || null,
    }).select('id').single()
    if (error) { alert('Erro ao cadastrar cliente'); setSavingClient(false); return }
    setClienteId(data.id)
    setNewClientNome('')
    setNewClientTelefone('')
    setNewClientInstagram('')
    setClientModalOpen(false)
    setSavingClient(false)
    const [cRes] = await Promise.all([
      supabase.from('clientes').select('id, nome').order('nome'),
    ])
    if (cRes.data) setClientes(cRes.data)
  }

  const subtotal = cart.reduce((acc, item) => acc + item.preco_venda * item.quantidade, 0)
  const descontoCalc = descontoTipo === 'percentual'
    ? subtotal * (Number(descontoInput) || 0) / 100
    : (Number(descontoInput) || 0)
  const descontoFinal = Math.min(descontoCalc, subtotal)
  const totalVenda = subtotal - descontoFinal

  async function handleSave() {
    if (!clienteId || cart.length === 0) return
    setSaving(true)

    const obsFinal = descontoFinal > 0
      ? `DESC:${descontoFinal.toFixed(2)}|${observacoes}`
      : observacoes

    const { data: vendaData, error: vendaErr } = await supabase.from('vendas').insert({
      data_venda: dataVenda,
      cliente_id: clienteId,
      forma_pagamento: formaPagamento,
      valor_total: totalVenda,
      observacoes: obsFinal || null,
    }).select('id').single()

    if (vendaErr || !vendaData) { alert('Erro ao criar venda'); setSaving(false); return }

    const itens = cart.map(item => ({
      venda_id: vendaData.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_venda: item.preco_venda,
      preco_custo: item.preco_custo,
    }))

    const { error: itensErr } = await supabase.from('itens_venda').insert(itens)
    if (itensErr) { alert('Erro ao registrar itens'); setSaving(false); return }

    setSaving(false)
    setModalOpen(false)
    fetchVendas()
  }

  const selectedProd = produtos.find(p => p.id === selectedProdId)
  const prodResults = searchProd.trim()
    ? produtos.filter(p =>
        p.quantidade > 0 &&
        (p.nome.toLowerCase().includes(searchProd.toLowerCase()) ||
         p.codigo_peca?.toLowerCase().includes(searchProd.toLowerCase()) ||
         p.referencia?.toLowerCase().includes(searchProd.toLowerCase()))
      ).slice(0, 15)
    : []
  const filteredVendas = vendas.filter(v => {
    if (!searchVenda) return true
    const nome = v.clientes?.nome?.toLowerCase() || ''
    return nome.includes(searchVenda.toLowerCase()) || v.forma_pagamento?.toLowerCase().includes(searchVenda.toLowerCase())
  })

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="p-6 border-b border-stone-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-lg font-bold text-stone-900">Vendas</h3>
          {canEdit(user?.perfil) && (
            <button onClick={openNew} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Registrar Venda
            </button>
          )}
        </div>

        <div className="p-4 border-b border-stone-100">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={searchVenda} onChange={e => setSearchVenda(e.target.value)} placeholder="Buscar por cliente ou pagamento..." className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-stone-400">Carregando...</div>
        ) : filteredVendas.length === 0 ? (
          <div className="text-center py-12 text-stone-400 m-6 border border-dashed rounded-lg border-stone-300">Nenhuma venda encontrada.</div>
        ) : (
          <div>
            {filteredVendas.map(v => {
              const { desconto, texto } = parseDesconto(v.observacoes)
              return (
                <div key={v.id} className="border-b border-stone-50 last:border-b-0">
                  <div className="flex items-center justify-between px-4 py-3 hover:bg-stone-50/50 cursor-pointer transition-colors" onClick={() => { setExpandedId(expandedId === v.id ? null : v.id); if (expandedId !== v.id) fetchItens(v.id) }}>
                    <div className="flex items-center gap-4 flex-1">
                      <div className="text-sm text-stone-500 font-mono w-24">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</div>
                      <div className="text-sm font-medium text-stone-900 flex-1">{v.clientes?.nome || 'Cliente removido'}</div>
                      <div className="text-xs bg-stone-100 px-2 py-0.5 rounded-full text-stone-600">{v.forma_pagamento}</div>
                      <div className="text-sm font-bold text-green-700">{Number(v.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                    {expandedId === v.id ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                  </div>
                  {expandedId === v.id && (
                    <div className="px-4 pb-3 bg-stone-50/50">
                      {itensVenda[v.id] ? (
                        <>
                          <table className="w-full text-sm mt-2">
                            <thead>
                              <tr className="text-xs text-stone-500 uppercase font-semibold">
                                <th className="text-left px-3 py-1.5">Produto</th>
                                <th className="text-right px-3 py-1.5">Qtd</th>
                                <th className="text-right px-3 py-1.5">Preço</th>
                                <th className="text-right px-3 py-1.5">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody>
                              {itensVenda[v.id].map(item => (
                                <tr key={item.id} className="border-t border-stone-100">
                                  <td className="px-3 py-2 text-stone-900">{item.produtos?.nome || 'Produto removido'}</td>
                                  <td className="px-3 py-2 text-right">{item.quantidade}</td>
                                  <td className="px-3 py-2 text-right">{Number(item.preco_venda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                  <td className="px-3 py-2 text-right">{(Number(item.preco_venda) * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {desconto > 0 && (
                            <div className="text-xs text-right mt-2 text-stone-500 pr-3">
                              Desconto: <span className="text-red-500 font-medium">-{desconto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            </div>
                          )}
                          {texto && <div className="text-xs text-stone-500 mt-2 px-3 italic">Obs: {texto}</div>}
                        </>
                      ) : (
                        <div className="text-center py-3 text-stone-400 text-sm">Carregando itens...</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-stone-900">Nova Venda</h4>
              <button onClick={() => setModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Data da Venda</label>
                  <input type="date" value={dataVenda} onChange={e => setDataVenda(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Forma de Pagamento</label>
                  <select value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white">
                    {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Cliente *</label>
                <div className="flex gap-2">
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white">
                    <option value="">Selecione um cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button type="button" onClick={() => setClientModalOpen(true)} className="px-3 py-2 border border-stone-200 rounded-lg text-stone-500 hover:text-brand-600 hover:border-brand-200 transition-colors" title="Cadastrar novo cliente">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4">
                <label className="block text-xs font-semibold text-stone-500 mb-3">Produtos</label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <label className="block text-xs text-stone-400 mb-1">Produto</label>
                    {selectedProdId ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm border border-brand-200 bg-brand-50 rounded-lg">
                        <span className="flex-1 truncate">{selectedProd.codigo_peca || ''} {selectedProd.nome} <span className="text-stone-400 text-xs">(estoque: {selectedProd.quantidade})</span></span>
                        <button onClick={() => { setSelectedProdId(''); setSearchProd('') }} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <input value={searchProd} onChange={e => { setSearchProd(e.target.value); setShowProdResults(true); setHighlightIdx(-1) }} onFocus={() => setShowProdResults(true)} onKeyDown={e => { if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, prodResults.length - 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)) } else if (e.key === 'Enter' && highlightIdx >= 0 && prodResults[highlightIdx]) { setSelectedProdId(prodResults[highlightIdx].id); setSelectedQty(1); setShowProdResults(false); setSearchProd('') } else if (e.key === 'Escape') setShowProdResults(false) }} placeholder="Buscar por nome, código ou referência..." className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                        {showProdResults && searchProd.trim() && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {prodResults.length === 0 ? (
                              <div className="px-3 py-2 text-sm text-stone-400">Nenhum produto encontrado.</div>
                            ) : (
                              prodResults.map((p, i) => (
                                <button key={p.id} onMouseEnter={() => setHighlightIdx(i)} onClick={() => { setSelectedProdId(p.id); setSelectedQty(1); setShowProdResults(false); setSearchProd('') }} className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-brand-50 transition-colors ${i === highlightIdx ? 'bg-brand-50' : ''}`}>
                                  <span className="font-medium text-stone-900">{p.codigo_peca || '---'}</span>
                                  <span className="text-stone-600 truncate">{p.nome}</span>
                                  <span className="ml-auto text-xs text-stone-400 shrink-0">estoque: {p.quantidade}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-stone-400 mb-1">Qtd</label>
                    <input type="number" min="1" max={selectedProd?.quantidade || 1} value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value))} className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                  </div>
                  <button onClick={addToCart} disabled={!selectedProdId} className="px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors">Adicionar</button>
                </div>

                {cart.length > 0 && (
                  <div className="mt-3 bg-stone-50 rounded-lg p-3 space-y-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-stone-500 uppercase font-semibold">
                          <th className="text-left pb-1">Produto</th>
                          <th className="text-right pb-1">Qtd</th>
                          <th className="text-right pb-1">Preço</th>
                          <th className="text-right pb-1">Subtotal</th>
                          <th className="text-center pb-1"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {cart.map((item, idx) => (
                          <tr key={idx} className="border-t border-stone-200">
                            <td className="py-1.5 pr-2 text-stone-900">{item.nome}</td>
                            <td className="py-1.5 text-right">{item.quantidade}</td>
                            <td className="py-1.5 text-right">{item.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="py-1.5 text-right font-medium">{(item.preco_venda * item.quantidade).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                            <td className="py-1.5 text-center"><button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Discount input */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-200">
                      <div className="text-sm text-stone-500">Subtotal:</div>
                      <div className="text-sm font-semibold text-stone-900 w-28 text-right">{subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                    <div className="flex items-center justify-end gap-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setDescontoTipo('percentual'); setDescontoInput('') }} className={`px-2 py-1 text-xs rounded transition-colors ${descontoTipo === 'percentual' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}><Percent className="w-3 h-3" /></button>
                        <button onClick={() => { setDescontoTipo('fixo'); setDescontoInput('') }} className={`px-2 py-1 text-xs rounded transition-colors ${descontoTipo === 'fixo' ? 'bg-brand-100 text-brand-700' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}><DollarSign className="w-3 h-3" /></button>
                        <input type="number" min="0" step={descontoTipo === 'percentual' ? '1' : '0.01'} value={descontoInput} onChange={e => setDescontoInput(e.target.value)} placeholder={descontoTipo === 'percentual' ? '%' : 'R$'} className="w-20 px-2 py-1 text-sm text-right border border-stone-200 rounded focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                      </div>
                      {descontoFinal > 0 && (
                        <div className="text-xs text-red-500 font-medium w-28 text-right">-{descontoFinal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-3 border-t-2 border-stone-300 pt-2 font-bold">
                      <div className="text-sm">Total:</div>
                      <div className="text-sm text-green-700 w-28 text-right">{totalVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Observações</label>
                <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} placeholder="Opcional..." className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-none" />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleSave} disabled={saving || !clienteId || cart.length === 0} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {saving ? 'Salvando...' : <><Check className="w-4 h-4" /> Finalizar Venda</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick client modal */}
      {clientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setClientModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h4 className="text-lg font-bold text-stone-900">Novo Cliente</h4>
              <button onClick={() => setClientModalOpen(false)} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Nome *</label>
                <input value={newClientNome} onChange={e => setNewClientNome(e.target.value)} placeholder="Nome do cliente" autoFocus className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Telefone</label>
                <input value={newClientTelefone} onChange={e => setNewClientTelefone(e.target.value)} placeholder="(11) 99999-9999" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Instagram</label>
                <input value={newClientInstagram} onChange={e => setNewClientInstagram(e.target.value)} placeholder="@cliente" className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100">
              <button onClick={() => setClientModalOpen(false)} className="px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors">Cancelar</button>
              <button onClick={handleQuickClient} disabled={savingClient || !newClientNome.trim()} className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
                {savingClient ? 'Salvando...' : <><Check className="w-4 h-4" /> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
