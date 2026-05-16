import { supabase } from '../lib/supabase'
import { Upload, Check, AlertCircle, FileSpreadsheet, ChevronRight, Database } from 'lucide-react'
import { useCallback, useState, type DragEvent } from 'react'
import * as XLSX from 'xlsx'

type PreviewProduto = {
  codigo_peca: string
  referencia: string
  nome: string
  categoria: string
  quantidade: number
  preco_custo: number
  percentual_lucro: number
  status_import: 'ok' | 'pular' | 'erro'
  motivo?: string
}

type PreviewCliente = {
  nome: string
  telefone: string
  instagram: string
  observacoes: string
  status_import: 'ok' | 'pular' | 'erro'
  motivo?: string
}

const statusToEnum: Record<string, string> = {
  'ESGOTADO': 'ESGOTADO',
  'BAIXA_NO_ESTOQUE': 'BAIXA_NO_ESTOQUE',
  'EM_ESTOQUE': 'EM_ESTOQUE',
}

const catMap: Record<string, string> = {
  'ANEL': 'ANEL',
  'BRINCO': 'BRINCO',
  'COLAR': 'COLAR',
  'PULSEIRA': 'PULSEIRA',
  'CONJUNTO': 'CONJUNTO',
  'TORNOZELEIRA': 'TORNOZELEIRA',
}

export function Importar() {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'done'>('upload')
  const [produtos, setProdutos] = useState<PreviewProduto[]>([])
  const [clientes, setClientes] = useState<PreviewCliente[]>([])
  const [result, setResult] = useState<{ produtos: number; clientes: number } | null>(null)
  const [error, setError] = useState('')

  function parseFile(file: File) {
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        parseWorkbook(wb)
      } catch {
        setError('Erro ao ler o arquivo. Verifique se é um Excel válido.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function parseWorkbook(wb: XLSX.WorkBook) {
    const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('estoque') || n.toLowerCase().includes('produto'))
    const clientSheet = wb.SheetNames.find(n => n.toLowerCase().includes('cliente'))

    const parsedProdutos: PreviewProduto[] = []
    const parsedClientes: PreviewCliente[] = []

    if (sheetName) {
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[sheetName], { defval: '' })
      const seen = new Set<string>()

      for (const row of data) {
        const nome = String(row['Nome da peça'] || row['Nome'] || row['nome'] || '').trim()
        if (!nome) continue

        const codigo = String(row['Código da peça'] || row['codigo_peca'] || '').trim()
        const ref = String(row['Referencia da peça'] || row['Referencia'] || row['referencia'] || '').trim()
        const cat = String(row['Categoria'] || row['categoria'] || '').trim().toUpperCase()
        const qtd = Number(row['Quantidade em estoque'] || row['Quantidade'] || row['quantidade'] || 0)
        const custo = Number(row['Preço de custo'] || row['preco_custo'] || 0)
        const lucro = Number(row['% Lucro'] || row['percentual_lucro'] || row['%'] || 1)

        const key = codigo || ref || nome
        if (seen.has(key)) continue
        seen.add(key)

        const p: PreviewProduto = {
          codigo_peca: codigo,
          referencia: ref,
          nome,
          categoria: catMap[cat] || '',
          quantidade: isNaN(qtd) ? 0 : Math.max(0, qtd),
          preco_custo: isNaN(custo) ? 0 : custo,
          percentual_lucro: isNaN(lucro) ? 1 : lucro,
          status_import: 'ok',
        }

        if (!p.categoria) { p.status_import = 'pular'; p.motivo = 'Categoria inválida' }
        if (p.preco_custo <= 0 && p.percentual_lucro <= 0) { p.status_import = 'pular'; p.motivo = 'Sem preço de custo' }

        parsedProdutos.push(p)
      }
    }

    if (clientSheet) {
      const data = XLSX.utils.sheet_to_json<any>(wb.Sheets[clientSheet], { defval: '' })
      for (const row of data) {
        const nome = String(row['Nome'] || row['nome'] || '').trim()
        if (!nome) continue
        parsedClientes.push({
          nome,
          telefone: String(row['Telefone'] || row['telefone'] || '').trim(),
          instagram: String(row['Instagram'] || row['instagram'] || '').trim(),
          observacoes: [String(row['Última compra'] || '').trim(), String(row['Observações'] || row['observacoes'] || '').trim()].filter(Boolean).join(' | '),
          status_import: 'ok',
        })
      }
    }

    setProdutos(parsedProdutos)
    setClientes(parsedClientes)
    setStep('preview')
  }

  async function handleImport() {
    setStep('importing')
    let prodCount = 0
    let clientCount = 0

    const okProdutos = produtos.filter(p => p.status_import === 'ok')
    const okClientes = clientes.filter(c => c.status_import === 'ok')

    for (const p of okProdutos) {
      const { error } = await supabase.from('produtos').insert({
        codigo_peca: p.codigo_peca || null,
        referencia: p.referencia || null,
        nome: p.nome,
        categoria: p.categoria,
        quantidade: p.quantidade,
        preco_custo: p.preco_custo,
        percentual_lucro: p.percentual_lucro,
      })
      if (!error) prodCount++
    }

    for (const c of okClientes) {
      const { error } = await supabase.from('clientes').insert({
        nome: c.nome,
        telefone: c.telefone || null,
        instagram: c.instagram || null,
        observacoes: c.observacoes || null,
      })
      if (!error) clientCount++
    }

    setResult({ produtos: prodCount, clientes: clientCount })
    setStep('done')
  }

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [])

  const okProd = produtos.filter(p => p.status_import === 'ok').length
  const pularProd = produtos.filter(p => p.status_import === 'pular').length
  const okCli = clientes.filter(c => c.status_import === 'ok').length

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-slate-900 mb-2">Importar Dados da Planilha</h3>
        <p className="text-sm text-slate-500">Importe produtos e clientes do arquivo Excel usado anteriormente para evitar retrabalho.</p>
      </div>

      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => document.getElementById('file-input')?.click()}
          className="bg-white rounded-xl border-2 border-dashed border-slate-300 shadow-sm p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all"
        >
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-1">Arraste o arquivo Excel aqui ou clique para selecionar</p>
          <p className="text-xs text-slate-400">Formatos aceitos: .xlsx, .xls</p>
          <input id="file-input" type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
          {error && <div className="mt-4 text-sm text-red-600 flex items-center justify-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</div>}
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-blue-600" /> Produtos</h4>
              <div className="text-xs text-slate-500">
                <span className="text-green-600 font-semibold">{okProd}</span> para importar
                {pularProd > 0 && <span className="text-amber-600 ml-2">{pularProd} ignorados</span>}
              </div>
            </div>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-xs text-slate-500 uppercase font-semibold border-b border-slate-100">
                    <th className="text-left px-3 py-2">Código</th>
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2">Categoria</th>
                    <th className="text-right px-3 py-2">Qtd</th>
                    <th className="text-right px-3 py-2">Custo</th>
                    <th className="text-right px-3 py-2">% Lucro</th>
                    <th className="text-center px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {produtos.map((p, i) => (
                    <tr key={i} className={`border-b border-slate-50 text-xs ${p.status_import === 'pular' ? 'text-slate-300' : ''}`}>
                      <td className="px-3 py-1.5 font-mono">{p.codigo_peca || '-'}</td>
                      <td className={`px-3 py-1.5 ${p.status_import === 'ok' ? 'text-slate-900' : ''}`}>{p.nome}</td>
                      <td className="px-3 py-1.5">{p.categoria || '-'}</td>
                      <td className="px-3 py-1.5 text-right">{p.quantidade}</td>
                      <td className="px-3 py-1.5 text-right">{p.preco_custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                      <td className="px-3 py-1.5 text-right">{(p.percentual_lucro * 100).toFixed(0)}%</td>
                      <td className="px-3 py-1.5 text-center">
                        {p.status_import === 'ok' ? <span className="text-green-600 text-[10px] flex items-center justify-center gap-0.5"><Check className="w-3 h-3" /> OK</span> : <span className="text-amber-500 text-[10px]" title={p.motivo}>{p.motivo}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-purple-600" /> Clientes</h4>
              <div className="text-xs text-slate-500"><span className="text-green-600 font-semibold">{okCli}</span> para importar</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500 uppercase font-semibold border-b border-slate-100">
                    <th className="text-left px-3 py-2">Nome</th>
                    <th className="text-left px-3 py-2">Telefone</th>
                    <th className="text-left px-3 py-2">Instagram</th>
                    <th className="text-left px-3 py-2">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c, i) => (
                    <tr key={i} className="border-b border-slate-50 text-xs">
                      <td className="px-3 py-1.5 text-slate-900">{c.nome}</td>
                      <td className="px-3 py-1.5">{c.telefone || '-'}</td>
                      <td className="px-3 py-1.5">{c.instagram || '-'}</td>
                      <td className="px-3 py-1.5 text-slate-500 max-w-[200px] truncate">{c.observacoes || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button onClick={() => setStep('upload')} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Voltar</button>
            <button onClick={handleImport} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5">
              <Database className="w-4 h-4" /> Importar {okProd > 0 ? `${okProd} produto${okProd > 1 ? 's' : ''}` : ''}{okProd > 0 && okCli > 0 ? ' e ' : ''}{okCli > 0 ? `${okCli} cliente${okCli > 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Importando dados...</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-green-600" />
          </div>
          <h4 className="text-lg font-bold text-slate-900 mb-2">Importação concluída!</h4>
          <div className="text-sm text-slate-500 space-y-1">
            <p><strong className="text-green-600">{result.produtos}</strong> produtos importados com sucesso</p>
            <p><strong className="text-purple-600">{result.clientes}</strong> clientes importados com sucesso</p>
            {pularProd > 0 && <p className="text-amber-600">{pularProd} produtos ignorados (categoria inválida ou sem preço)</p>}
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => { setStep('upload'); setProdutos([]); setClientes([]); setResult(null) }} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Importar outro arquivo</button>
            <a href="/produtos" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors inline-flex items-center gap-1.5">
              Ver Produtos <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
