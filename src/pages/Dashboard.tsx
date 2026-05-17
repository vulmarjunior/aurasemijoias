import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { useEffect, useState } from 'react'
import { Package, TrendingUp, AlertTriangle, DollarSign, ShoppingCart, ChevronDown, ChevronRight, Sun, Moon, Receipt, XCircle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const frases = [
  "O sucesso é a soma de pequenos esforços repetidos dia após dia.",
  "A persistência é o caminho do êxito.",
  "Acredite em você e tudo será possível.",
  "Grandes realizações nascem de pequenos começos.",
  "Não espere por oportunidades, crie-as.",
  "O único lugar onde o sucesso vem antes do trabalho é no dicionário.",
  "Seja a mudança que você deseja ver no mundo.",
  "Faça hoje o que outros não fazem para ter amanhã o que outros não terão.",
  "A jornada de mil milhas começa com um único passo.",
  "A excelência não é um ato, mas um hábito.",
  "A melhor maneira de prever o futuro é criá-lo.",
  "Tudo o que você sempre quis está do outro lado do medo.",
  "O segredo para começar é parar de falar e começar a fazer.",
  "A ação é a chave fundamental para todo sucesso.",
  "Seu único limite é você mesmo.",
]

const versiculos = [
  { texto: "Tudo posso naquele que me fortalece.", ref: "Filipenses 4:13" },
  { texto: "O Senhor é o meu pastor; nada me faltará.", ref: "Salmos 23:1" },
  { texto: "Ora, a fé é a certeza daquilo que esperamos e a prova das coisas que não vemos.", ref: "Hebreus 11:1" },
  { texto: "Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.", ref: "Eclesiastes 3:1" },
  { texto: "Sede fortes e corajosos; não temais, nem vos espanteis diante deles, porque o Senhor vosso Deus é quem vai convosco.", ref: "Deuteronômio 31:6" },
  { texto: "Não andeis ansiosos por coisa alguma; antes, em tudo, sejam os vossos pedidos conhecidos diante de Deus.", ref: "Filipenses 4:6" },
  { texto: "O Senhor é bom, é fortaleza no dia da angústia e conhece os que nele confiam.", ref: "Naum 1:7" },
  { texto: "Tu és o meu refúgio e a minha fortaleza, o meu Deus, em quem confio.", ref: "Salmos 91:2" },
  { texto: "Esforça-te, e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor teu Deus é contigo.", ref: "Josué 1:9" },
  { texto: "Bem-aventurado é aquele que teme ao Senhor e anda nos seus caminhos.", ref: "Salmos 128:1" },
  { texto: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti.", ref: "Números 6:24-25" },
  { texto: "Confia ao Senhor as tuas obras, e teus pensamentos serão estabelecidos.", ref: "Provérbios 16:3" },
  { texto: "Aquietai-vos e sabei que eu sou Deus.", ref: "Salmos 46:10" },
  { texto: "O coração alegre aformoseia o rosto, mas com a tristeza do coração o espírito se abate.", ref: "Provérbios 15:13" },
  { texto: "Portanto, não vos preocupeis com o amanhã, pois o amanhã trará as suas próprias preocupações.", ref: "Mateus 6:34" },
]

type Venda = {
  id: string
  data_venda: string
  valor_total: number
  status?: string
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
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [totalEstoque, setTotalEstoque] = useState(0)
  const [valorEstoque, setValorEstoque] = useState(0)
  const [vendasMes, setVendasMes] = useState(0)
  const [faturamentoMes, setFaturamentoMes] = useState(0)
  const [lucroMes, setLucroMes] = useState(0)
  const [cancelamentosMes, setCancelamentosMes] = useState(0)
  const [esgotados, setEsgotados] = useState<Produto[]>([])
  const [baixaEstoque, setBaixaEstoque] = useState<Produto[]>([])
  const [showBaixa, setShowBaixa] = useState(false)
  const [ultimasVendas, setUltimasVendas] = useState<Venda[]>([])
  const [chartData, setChartData] = useState<MonthlyData[]>([])

  const saudacao = new Date().getHours() < 12 ? 'Bom dia' : new Date().getHours() < 18 ? 'Boa tarde' : 'Boa noite'
  const [frase] = useState(() => frases[Math.floor(Math.random() * frases.length)])
  const [versiculo] = useState(() => versiculos[Math.floor(Math.random() * versiculos.length)])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)

    const now = new Date()
    const mesStart = startOfMonth(now).toISOString().split('T')[0]
    const mesEnd = endOfMonth(now).toISOString().split('T')[0]

    const [prodRes, vendasRes, itensRes, alertasRes, ultVendasRes, canceladosRes] = await Promise.all([
      supabase.from('produtos').select('quantidade, preco_custo, valor_venda'),
      supabase.from('vendas').select('valor_total').eq('status', 'ATIVA').gte('data_venda', mesStart).lte('data_venda', mesEnd),
      supabase.from('itens_venda').select('lucro, vendas!inner(data_venda, status)').eq('vendas.status', 'ATIVA').gte('vendas.data_venda', mesStart).lte('vendas.data_venda', mesEnd),
      supabase.from('produtos').select('id, nome, codigo_peca, status, quantidade').or('status.eq.BAIXA_NO_ESTOQUE,status.eq.ESGOTADO'),
      supabase.from('vendas').select('*, clientes(nome)').order('criado_em', { ascending: false }).limit(5),
      supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('status', 'CANCELADA').gte('data_venda', mesStart).lte('data_venda', mesEnd),
    ])

    if (prodRes.data) {
      setTotalEstoque(prodRes.data.reduce((acc, p) => acc + p.quantidade, 0))
      setValorEstoque(prodRes.data.reduce((acc, p) => acc + Number(p.valor_venda) * p.quantidade, 0))
    }

    if (vendasRes.data) {
      setVendasMes(vendasRes.data.length)
      setFaturamentoMes(vendasRes.data.reduce((acc, v) => acc + Number(v.valor_total), 0))
    }

    if (itensRes.data) {
      setLucroMes(itensRes.data.reduce((acc, i) => acc + Number(i.lucro), 0))
    }

    setCancelamentosMes(canceladosRes.count ?? 0)

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
      const { data } = await supabase.from('vendas').select('valor_total').eq('status', 'ATIVA').gte('data_venda', s).lte('data_venda', e)
      monthsData.push({
        mes: format(d, 'MMM', { locale: ptBR }),
        faturamento: data ? data.reduce((acc, v) => acc + Number(v.valor_total), 0) : 0,
      })
    }
    setChartData(monthsData)

    setLoading(false)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px] text-stone-400">Carregando dashboard...</div>
  )

  const margem = faturamentoMes > 0 ? (lucroMes / faturamentoMes) * 100 : 0
  const ticketMedio = vendasMes > 0 ? faturamentoMes / vendasMes : 0

  return (
    <div className="space-y-6">
      {/* Boas-Vindas */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-700 rounded-xl p-6 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white/20 rounded-lg shrink-0 mt-0.5">
            {new Date().getHours() < 12 ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold">{saudacao}, {user?.nome || 'usuário'}!</h2>
            <p className="text-sm text-white/80 mt-1 italic">&ldquo;{frase}&rdquo;</p>
            <div className="mt-2 pt-2 border-t border-white/20">
              <p className="text-xs text-white/70">{versiculo.texto} <span className="font-semibold text-white/90">&mdash; {versiculo.ref}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Total Estoque</div>
            <div className="p-1.5 bg-brand-50 rounded-lg"><Package className="w-3.5 h-3.5 text-brand-600" /></div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{totalEstoque}</div>
          <div className="text-xs text-stone-400 mt-0.5">unidades</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Valor Estoque</div>
            <div className="p-1.5 bg-green-50 rounded-lg"><DollarSign className="w-3.5 h-3.5 text-green-600" /></div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{valorEstoque.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Faturamento</div>
            <div className="p-1.5 bg-emerald-50 rounded-lg"><TrendingUp className="w-3.5 h-3.5 text-emerald-600" /></div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{faturamentoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div className="text-xs text-stone-400 mt-0.5">{vendasMes} venda{vendasMes !== 1 ? 's' : ''} no mês</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Ticket Médio</div>
            <div className="p-1.5 bg-blue-50 rounded-lg"><Receipt className="w-3.5 h-3.5 text-blue-600" /></div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div className="text-xs text-stone-400 mt-0.5">por venda</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Lucro</div>
            <div className="p-1.5 bg-purple-50 rounded-lg"><ShoppingCart className="w-3.5 h-3.5 text-purple-600" /></div>
          </div>
          <div className="text-2xl font-bold text-green-600">{lucroMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
          <div className="text-xs mt-0.5">{faturamentoMes > 0 ? <span className="text-brand-600 font-semibold">Margem: {margem.toFixed(1)}%</span> : <span className="text-stone-400">Sem vendas</span>}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-stone-500 text-xs font-semibold uppercase tracking-wider">Cancelamentos</div>
            <div className="p-1.5 bg-red-50 rounded-lg"><XCircle className="w-3.5 h-3.5 text-red-500" /></div>
          </div>
          <div className="text-2xl font-bold text-stone-900">{cancelamentosMes}</div>
          <div className="text-xs text-stone-400 mt-0.5">no mês</div>
        </div>
      </div>

      {/* Chart — full width */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-900 mb-4">Faturamento Mensal</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
              <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#a8a29e' }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />
              <Tooltip formatter={(value: number) => [value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Faturamento']} contentStyle={{ borderRadius: 8, border: '1px solid #e7e5e4', fontSize: 12 }} />
              <Bar dataKey="faturamento" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-stone-400">Nenhum dado de faturamento ainda.</div>
        )}
      </div>

      {/* Alerts — below chart, compact */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <h3 className="text-sm font-bold text-stone-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          Alertas de Estoque
        </h3>

        {esgotados.length === 0 && baixaEstoque.length === 0 ? (
          <div className="text-center py-6 text-stone-400 text-sm">Nenhum alerta no momento.</div>
        ) : (
          <div className="space-y-1">
            {/* ESGOTADOS — always visible */}
            {esgotados.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm border-b border-stone-50 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                  <span className="font-medium text-stone-900 truncate">{p.nome}</span>
                  {p.codigo_peca && <span className="text-xs text-stone-400 shrink-0">{p.codigo_peca}</span>}
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-800 shrink-0 ml-2">Esgotado</span>
              </div>
            ))}

            {/* BAIXA_NO_ESTOQUE — toggle */}
            {baixaEstoque.length > 0 && (
              <>
                <button onClick={() => setShowBaixa(!showBaixa)} className="flex items-center gap-1.5 w-full py-2 text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors">
                  {showBaixa ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {showBaixa ? 'Ocultar' : 'Ver'} {baixaEstoque.length} produto{baixaEstoque.length !== 1 ? 's' : ''} com baixa no estoque
                </button>
                {showBaixa && baixaEstoque.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 pl-5 text-sm border-b border-stone-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                      <span className="font-medium text-stone-900 truncate">{p.nome}</span>
                      {p.codigo_peca && <span className="text-xs text-stone-400 shrink-0">{p.codigo_peca}</span>}
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
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <h3 className="text-sm font-bold text-stone-900 mb-4">Últimas Vendas</h3>
        {ultimasVendas.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-sm">Nenhuma venda registrada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-500 uppercase font-semibold border-b border-stone-100">
                  <th className="text-left px-3 py-2">Data</th>
                  <th className="text-left px-3 py-2">Cliente</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                  {ultimasVendas.map(v => (
                  <tr key={v.id} className="border-b border-stone-50">
                    <td className="px-3 py-2 text-stone-500 font-mono text-xs">{new Date(v.data_venda).toLocaleDateString('pt-BR')}</td>
                    <td className="px-3 py-2 font-medium text-stone-900">{v.clientes?.nome || 'Cliente removido'}</td>
                    <td className="px-3 py-2">
                      {v.status === 'CANCELADA' ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-800">Cancelada</span>
                      ) : (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">Ativa</span>
                      )}
                    </td>
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
