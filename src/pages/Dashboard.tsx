import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { Package, TrendingUp, AlertTriangle, DollarSign, ShoppingCart, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type Venda = {
  id: string
  data_venda: string
  valor_total: number
  clientes?: { nome: string }
}

type Produto = {
  id: string
  nome: string
  codigo_peca: string
  status: string
  quantidade: number
}

type MonthlyData = {
  mes: string
  faturamento: number
}

export function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [totalProdutos, setTotalProdutos] = useState(0)
  const [valorEstoque, setValorEstoque] = useState(0)
  const [vendasMes, setVendasMes] = useState(0)
  const [faturamentoMes, setFaturamentoMes] = useState(0)
  const [lucroMes, setLucroMes] = useState(0)
  const [esgotados, setEsgotados] = useState<Produto[]>([])
  const [baixaEstoque, setBaixaEstoque] = useState<Produto[]>([])
  const [showBaixa, setShowBaixa] = useState(false)
  const [ultimasVendas, setUltimasVendas] = useState<Venda[]>([])
  const [chartData, setChartData] = useState<MonthlyData[]>([])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    const now = new Date()
    const mesStart = startOfMonth(now).toISOString().split('T')[0]
    const mesEnd = endOfMonth(now).toISOString().split('T')[0]

    const [prodRes, vendasRes, itensRes, alertasRes, ultVendasRes] = await Promise.all([
      supabase.from('produtos').select('quantidade, preco_custo, valor_venda'),
      supabase.from('vendas').select('valor_total').gte('data_venda', mesStart).lte('data_venda', mesEnd),
      supabase.from('itens_venda').select('lucro, vendas!inner(data_venda)').gte('vendas.data_venda', mesStart).lte('vendas.data_venda', mesEnd),
      supabase.from('produtos').select('id, nome, codigo_peca, status, quantidade').or('status.eq.BAIXA_NO_ESTOQUE,status.eq.ESGOTADO'),
      supabase.from('vendas').select('*, clientes(nome)').order('criado_em', { ascending: false }).limit(5),
    ])

    if (prodRes.data) {
      setTotalProdutos(prodRes.data.length)
      setValorEstoque(prodRes.data.reduce((acc, p) => acc + Number(p.valor_venda) * p.quantidade, 0))
    }

    if (vendasRes.data) {
      setVendasMes(vendasRes.data.length)
      setFaturamentoMes(vendasRes.data.reduce((acc, v) => acc + Number(v.valor_total), 0))
    }

    if (itensRes.data) {
      setLucroMes(itensRes.data.reduce((acc, i) => acc + Number(i.lucro), 0))
    }

    if (alertasRes.data) {
      setEsgotados(alertasRes.data.filter(p => p.status === 'ESGOTADO'))
      setBaixaEstoque(alertasRes.data.filter(p => p.status === 'BAIXA_NO_ESTOQUE'))
    }
    if (ultVendasRes.data) setUltimasVendas(ultVendasRes.data)

    const monthsData: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i)
      const s = startOfMonth(d).toISOString().split('T')[0]
      const e = endOfMonth(d).toISOString().split('T')[0]
      const { data } = await supabase.from('vendas').select('valor_total').gte('data_venda', s).lte('data_venda', e)
      monthsData.push({
        mes: format(d, 'MMM', { locale: ptBR }),
        faturamento: data ? data.reduce((acc, v) => acc + Number(v.valor_total), 0) : 0,
      })
    }
    setChartData(monthsData)

    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px] text-slate-400">Carregando dashboard...</div>
  )

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Total Produtos</div>
            <div className="p-2 bg-blue-50 rounded-lg"><Package className="w-4 h-4 text-blue-600" /></div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{totalProdutos}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Valor em Estoque</div>
            <div className="p-2 bg-green-50 rounded-lg"><DollarSign className="w-4 h-4 text-green-600" /></div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{valorEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Faturamento (Mês)</div>
            <div className="p-2 bg-emerald-50 rounded-lg"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
          </div>
          <div className="text-3xl font-bold text-slate-900">{faturamentoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div className="text-xs text-slate-400 mt-1">{vendasMes} venda{vendasMes !== 1 ? 's' : ''} no mês</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-slate-500 text-xs font-semibold uppercase tracking-wider">Lucro (Mês)</div>
            <div className="p-2 bg-purple-50 rounded-lg"><ShoppingCart className="w-4 h-4 text-purple-600" /></div>
          </div>
          <div className="text-3xl font-bold text-green-600">{lucroMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Faturamento Mensal</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Tooltip formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Faturamento']} contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="faturamento" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-400">Nenhum dado de faturamento ainda.</div>
        )}
      </div>

      {/* Alerts — below chart, compact */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Alertas de Estoque
        </h3>

        {esgotados.length === 0 && baixaEstoque.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-sm">Nenhum alerta no momento.</div>
        ) : (
          <div className="space-y-1">
            {/* ESGOTADOS — always visible */}
            {esgotados.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium text-slate-900 truncate">{p.nome}</span>
                  {p.codigo_peca && <span className="text-xs text-slate-400 shrink-0">{p.codigo_peca}</span>}
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800 shrink-0 ml-2">Esgotado</span>
              </div>
            ))}

            {/* BAIXA_NO_ESTOQUE — toggle */}
            {baixaEstoque.length > 0 && (
              <>
                <button onClick={() => setShowBaixa(!showBaixa)} className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
                  {showBaixa ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {showBaixa ? 'Ocultar' : 'Ver'} {baixaEstoque.length} produto{baixaEstoque.length !== 1 ? 's' : ''} com baixa no estoque
                </button>
                {showBaixa && baixaEstoque.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 pl-5 text-sm border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                      <span className="font-medium text-slate-900 truncate">{p.nome}</span>
                      {p.codigo_peca && <span className="text-xs text-slate-400 shrink-0">{p.codigo_peca}</span>}
                    </div>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 shrink-0 ml-2">{p.quantidade} un.</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Últimas Vendas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Últimas Vendas</h3>
        {ultimasVendas.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-sm">Nenhuma venda registrada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 uppercase font-semibold border-b border-slate-100">
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-right px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ultimasVendas.map(v => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-slate-500 font-mono text-xs">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{v.clientes?.nome || 'Cliente removido'}</td>
                    <td className="px-3 py-2 text-right font-medium text-green-700">{Number(v.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
