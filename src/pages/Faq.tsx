import {
  HelpCircle, LogIn, Package, Tag, ShoppingCart, Users,
  ArrowRightLeft, Upload, BarChart3, Settings, WifiOff,
  Search, ChevronDown, ExternalLink
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

type FaqItem = {
  id: string
  q: string
  r: string
}

type FaqSection = {
  title: string
  icon: typeof HelpCircle
  items: FaqItem[]
}

const sections: FaqSection[] = [
  {
    title: 'Login e Acesso',
    icon: LogIn,
    items: [
      {
        id: 'como-fazer-login',
        q: 'Como fazer login?',
        r: 'Acesse a página inicial do sistema. Digite seu email e senha cadastrados e clique em "Entrar". Não há opção de criar conta própria — apenas administradores podem criar novos usuários.',
      },
      {
        id: 'esqueci-minha-senha',
        q: 'Esqueci minha senha, o que faço?',
        r: 'No momento o sistema não possui recuperação automática de senha. Solicite ao administrador (vulmarjunior@gmail.com) para redefinir sua senha pelo painel do Supabase.',
      },
      {
        id: 'perfis-acesso',
        q: 'O que significa meu perfil (ADMIN/USER/VIEWER)?',
        r: 'ADMIN: acesso total — cadastrar, editar, excluir e gerenciar usuários. USER: pode cadastrar e editar, mas não excluir nem gerenciar usuários. VIEWER: apenas visualiza os dados, sem permissão para alterar nada.',
      },
    ],
  },
  {
    title: 'Produtos (Estoque)',
    icon: Package,
    items: [
      {
        id: 'cadastrar-produto',
        q: 'Como cadastrar um novo produto?',
        r: 'Vá em "Estoque" e clique em "Novo Produto". Preencha os campos obrigatórios (Nome, Categoria, Quantidade) e os financeiros. O Valor de Venda é calculado automaticamente com base no Custo e % Lucro, mas você pode digitar diretamente para arredondar.',
      },
      {
        id: 'status-produto',
        q: 'O que significam os status ESGOTADO / BAIXA NO ESTOQUE / EM ESTOQUE?',
        r: 'O status é calculado automaticamente pelo sistema com base na quantidade: ESGOTADO = 0 unidades, BAIXA_NO_ESTOQUE = 1 ou 2 unidades, EM_ESTOQUE = 3 ou mais unidades. Não é possível editar manualmente.',
      },
      {
        id: 'arredondar-valor-venda',
        q: 'Como definir o valor de venda com arredondamento?',
        r: 'No formulário do produto, digite o valor desejado no campo "Valor de Venda (R$)". O percentual de lucro será recalculado automaticamente com base no valor digitado. Ex: se o custo é R$ 50,00 e você quer vender por R$ 149,90, basta digitar 149.90.',
      },
      {
        id: 'codigo-referencia',
        q: 'Qual a diferença entre Código da Peça e Referência?',
        r: 'Código da Peça: identificação interna da loja (ex: A-001). Referência: código do fornecedor ou fabricante. Ambos são opcionais e usados para busca.',
      },
      {
        id: 'editar-excluir-produto',
        q: 'Posso editar ou excluir um produto?',
        r: 'Sim. Clique no ícone de lápis (editar) ou lixeira (excluir) na linha do produto. Se o perfil for VIEWER, os botões não aparecem. Se for USER, pode editar mas não excluir.',
      },
    ],
  },
  {
    title: 'Categorias',
    icon: Tag,
    items: [
      {
        id: 'criar-categoria',
        q: 'Como criar ou editar uma categoria?',
        r: 'Vá em "Configurações" > aba "Categorias". Clique em "Nova Categoria" ou no lápis para editar. O nome é salvo em MAIÚSCULAS automaticamente. As categorias são dinâmicas — diferente de um sistema com lista fixa.',
      },
      {
        id: 'excluir-categoria',
        q: 'Por que não consigo excluir uma categoria?',
        r: 'Categorias que possuem produtos associados não podem ser excluídas. Remova ou reatribua os produtos para outra categoria primeiro, depois exclua.',
      },
    ],
  },
  {
    title: 'Vendas',
    icon: ShoppingCart,
    items: [
      {
        id: 'registrar-venda',
        q: 'Como registrar uma venda?',
        r: 'Vá em "Vendas" e clique em "Registrar Venda". Selecione data, cliente e forma de pagamento. Adicione produtos digitando o nome ou código no campo de busca com autocomplete. Ajuste a quantidade e clique em "Adicionar". O subtotal é calculado automaticamente.',
      },
      {
        id: 'desconto-venda',
        q: 'Como aplicar desconto (porcentagem ou valor fixo)?',
        r: 'No carrinho da venda, use os botões % (porcentagem) ou R$ (valor fixo) para escolher o tipo de desconto. Digite o valor e o total será recalculado automaticamente. O desconto fica registrado nas observações como "DESC:valor".',
      },
      {
        id: 'estoque-automatico',
        q: 'O estoque baixa automaticamente ao vender?',
        r: 'Sim! Ao finalizar uma venda, o sistema subtrai automaticamente as quantidades vendidas do estoque. O status do produto é recalculado (EM_ESTOQUE, BAIXA, ESGOTADO). Produtos com quantidade zero não podem ser adicionados à venda.',
      },
      {
        id: 'cliente-rapido',
        q: 'Como cadastrar um cliente rápido na hora da venda?',
        r: 'No formulário de venda, ao lado do campo "Cliente" há um botão "+". Clique para abrir um modal de cadastro rápido. Preencha nome (obrigatório) e opcionais (telefone, Instagram) e salve. O cliente já fica selecionado na venda.',
      },
      {
        id: 'desconto-observacoes',
        q: 'O que significa o desconto salvo nas observações?',
        r: 'O desconto é armazenado no campo "Observações" da venda com o formato DESC:valor|texto. Ex: "DESC:15.50|Cliente fidelidade". Isso permite consultar descontos históricos sem criar colunas extras no banco.',
      },
    ],
  },
  {
    title: 'Clientes',
    icon: Users,
    items: [
      {
        id: 'cadastrar-cliente',
        q: 'Como cadastrar um cliente?',
        r: 'Vá em "Clientes" e clique em "Novo Cliente". Preencha nome (obrigatório), telefone, Instagram e observações. O telefone tem máscara automática no formato (11) 99999-9999.',
      },
      {
        id: 'telefone-mascara',
        q: 'O telefone tem máscara automática?',
        r: 'Sim. Ao digitar o telefone, o campo formata automaticamente para (XX) XXXXX-XXXX. Apenas números são armazenados no banco, exibidos com formatação.',
      },
      {
        id: 'whatsapp-cliente',
        q: 'Como abrir WhatsApp do cliente?',
        r: 'Na listagem de clientes, clique no número de telefone. O sistema abre o WhatsApp Web em uma nova aba com o número já preenchido, pronto para enviar mensagem.',
      },
    ],
  },
  {
    title: 'Movimentações de Estoque',
    icon: ArrowRightLeft,
    items: [
      {
        id: 'registrar-movimentacao',
        q: 'Como registrar entrada ou saída manual?',
        r: 'Vá em "Movimentações" e clique em "Nova Movimentação". Escolha o tipo (Entrada ou Saída), o produto, a quantidade e o responsável. Ao salvar, o estoque é atualizado automaticamente.',
      },
      {
        id: 'saida-maior-que-estoque',
        q: 'Por que não consigo dar saída maior que o estoque?',
        r: 'O sistema bloqueia saídas que deixariam o estoque negativo. Se tentar, aparece um alerta informando a quantidade disponível. Registre uma entrada primeiro ou ajuste a quantidade.',
      },
    ],
  },
  {
    title: 'Importar Planilha',
    icon: Upload,
    items: [
      {
        id: 'importar-excel',
        q: 'Como importar dados do Excel?',
        r: 'Vá em "Importar Planilha". Arraste um arquivo .xlsx ou .xls na área indicada ou clique para selecionar. O sistema lê as abas "Estoque/Produtos" e "Clientes". Você vê uma prévia antes de confirmar a importação.',
      },
      {
        id: 'categoria-invalida-importacao',
        q: 'O que acontece se um produto tiver categoria inválida?',
        r: 'Produtos com categoria que não existe no sistema (ANEL, BRINCO, COLAR, PULSEIRA, CONJUNTO, TORNOZELEIRA) são marcados como "pular" na prévia e não são importados. Crie a categoria primeiro ou corrija a planilha.',
      },
    ],
  },
  {
    title: 'Dashboard',
    icon: BarChart3,
    items: [
      {
        id: 'cards-dashboard',
        q: 'O que significam os cards do dashboard?',
        r: 'Total Produtos: quantidade de produtos cadastrados. Valor em Estoque: soma do valor de venda de todos os produtos. Faturamento (Mês): total vendido no mês atual. Lucro (Mês): lucro total das vendas do mês.',
      },
      {
        id: 'grafico-vazio',
        q: 'Por que o gráfico de faturamento está vazio?',
        r: 'O gráfico mostra os últimos 6 meses. Se não há vendas registradas no período, ele exibe "Nenhum dado de faturamento ainda". Comece a registrar vendas que o gráfico será preenchido automaticamente.',
      },
      {
        id: 'alertas-estoque',
        q: 'Como vejo produtos com baixa no estoque?',
        r: 'Na seção "Alertas de Estoque" do dashboard, produtos ESGOTADOS aparecem sempre visíveis. Produtos com BAIXA_NO_ESTOQUE (1-2 unidades) ficam ocultos — clique em "Ver N produtos com baixa no estoque" para expandir.',
      },
    ],
  },
  {
    title: 'Configurações',
    icon: Settings,
    items: [
      {
        id: 'alterar-senha',
        q: 'Como alterar minha senha?',
        r: 'Vá em "Configurações" > aba "Meu Perfil". Clique em "Alterar Senha". Digite a senha atual e a nova senha. A senha atual é verificada antes de permitir a alteração.',
      },
      {
        id: 'criar-usuario',
        q: 'Como criar um novo usuário?',
        r: 'Apenas administradores (ADMIN) podem criar usuários. Vá em "Configurações" > aba "Usuários" > "Novo Usuário". Preencha nome, email, senha inicial e perfil. O usuário receberá as permissões do perfil escolhido.',
      },
      {
        id: 'perfil-permissoes',
        q: 'O que cada perfil pode fazer?',
        r: 'ADMIN: criar/editar/excluir produtos, clientes, vendas, movimentações, gerenciar categorias e criar/gerenciar usuários. USER: criar e editar (sem excluir), sem acesso a gerenciamento de usuários. VIEWER: apenas visualizar, nenhum botão de ação aparece.',
      },
    ],
  },
  {
    title: 'Offline e PWA',
    icon: WifiOff,
    items: [
      {
        id: 'usar-sem-internet',
        q: 'Posso usar o sistema sem internet?',
        r: 'O sistema é PWA (Progressive Web App). As páginas já visitadas ficam em cache e podem ser acessadas offline. Porém, operações que precisam do banco (cadastrar, editar, listar dados) exigem conexão. Uma página "Sem Conexão" é exibida quando você está offline.',
      },
      {
        id: 'instalar-celular',
        q: 'Como instalar o sistema no celular?',
        r: 'No Chrome ou navegador compatível, acesse aurasemijoias.vercel.app. Toque no menu do navegador (três pontinhos) e selecione "Adicionar à tela inicial" (Android) ou "Compartilhar > Adicionar à Tela de Início" (iOS). O sistema abre como um aplicativo, sem a barra do navegador.',
      },
    ],
  },
]

export function Faq() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [openItems, setOpenItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const hash = location.hash.replace('#', '')
    if (hash) {
      setOpenItems(prev => new Set(prev).add(hash))
      setTimeout(() => {
        document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    }
  }, [location.hash])

  function toggle(id: string) {
    setOpenItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return sections
    const q = search.toLowerCase()
    return sections
      .map(s => ({
        ...s,
        items: s.items.filter(i => i.q.toLowerCase().includes(q) || i.r.toLowerCase().includes(q)),
      }))
      .filter(s => s.items.length > 0)
  }, [search])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-1">
          <HelpCircle className="w-6 h-6 text-brand-600" />
          <h3 className="text-lg font-bold text-stone-900">Perguntas Frequentes</h3>
        </div>
        <p className="text-sm text-stone-500 mb-4">Tire dúvidas sobre o funcionamento do sistema.</p>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por palavra-chave..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          />
        </div>
      </div>

      {filtered.map(section => (
        <div key={section.title} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 bg-stone-50 border-b border-stone-200">
            <section.icon className="w-4 h-4 text-brand-600" />
            <h4 className="text-sm font-bold text-stone-800 uppercase tracking-wider">{section.title}</h4>
            <span className="ml-auto text-xs text-stone-400">{section.items.length} pergunta{section.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-stone-100">
            {section.items.map(item => {
              const isOpen = openItems.has(item.id)
              return (
                <div key={item.id} id={item.id}>
                  <button
                    onClick={() => toggle(item.id)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-left text-sm font-medium text-stone-900 hover:bg-stone-50 transition-colors"
                  >
                    <ChevronDown className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`} />
                    <span className="flex-1">{item.q}</span>
                    <a href={`#${item.id}`} onClick={e => e.stopPropagation()} className="text-stone-300 hover:text-brand-600 transition-colors" title="Copiar link direto">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed pl-12">
                      {item.r}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {filtered.length === 0 && search.trim() && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 text-center">
          <HelpCircle className="w-8 h-8 text-stone-300 mx-auto mb-3" />
          <p className="text-stone-500 text-sm">Nenhum resultado para "<strong>{search}</strong>"</p>
          <button onClick={() => setSearch('')} className="mt-2 text-xs text-brand-600 hover:text-brand-700">Limpar busca</button>
        </div>
      )}
    </div>
  )
}
