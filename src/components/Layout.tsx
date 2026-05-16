import { format } from 'date-fns';
import { 
  BarChart3, 
  Box, 
  Users, 
  ShoppingCart, 
  ArrowRightLeft, 
  Upload,
  Settings,
  Menu,
  X,
  LogOut,
  User
} from 'lucide-react';
import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const navItems = [
  { path: '/', label: 'Dashboard', icon: BarChart3 },
  { path: '/produtos', label: 'Estoque', icon: Box },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { path: '/movimentacoes', label: 'Movimentações', icon: ArrowRightLeft },
];

const bottomItems = [
  { path: '/importar', label: 'Importar Planilha', icon: Upload },
  { path: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50 font-sans text-stone-900">
      {/* Mobile sidebar backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-stone-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col border-r border-stone-200 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6 relative flex flex-col justify-center border-b border-stone-100 text-center items-center">
          <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 lg:hidden text-stone-400 hover:text-stone-600">
            <X className="w-5 h-5" />
          </button>
          <img src="/logo.jpg" alt="Aura Semijoias" className="h-20 w-auto object-contain mb-2" onError={(e) => {
            e.currentTarget.style.display = 'none';
            e.currentTarget.nextElementSibling?.classList.remove('hidden');
          }} />
          <div className="hidden flex-col items-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="w-8 h-8 text-amber-700 mb-1">
              <path d="M12 2L15 9L22 9L16 14L18 21L12 17L6 21L8 14L2 9L9 9L12 2Z" fill="currentColor" opacity="0.2"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L15 9L22 9L16 14L18 21L12 17L6 21L8 14L2 9L9 9L12 2Z"/>
            </svg>
            <span className="text-stone-800 font-serif italic text-2xl tracking-tighter">Aura</span>
            <span className="text-stone-500 text-[10px] tracking-widest uppercase mt-1">Semijoias</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="text-[10px] uppercase font-bold text-stone-400 px-3 mb-2 tracking-widest">Menu Principal</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all relative border ${
                  isActive 
                    ? 'bg-brand-50 text-brand-800 font-medium border-brand-200' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border-transparent'
                }`}
                onClick={() => setIsSidebarOpen(false)}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-brand-400 to-brand-600 rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600': 'text-stone-400'}`} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        
        <div className="mt-auto p-4 border-t border-stone-100 space-y-1">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm transition-all relative border ${
                  isActive 
                    ? 'bg-brand-50 text-brand-800 font-medium border-brand-200' 
                    : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 border-transparent'
                }`}
                onClick={() => setIsSidebarOpen(false)}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gradient-to-b from-brand-400 to-brand-600 rounded-r-full" />
                )}
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600': 'text-stone-400'}`} />
                {item.label}
              </NavLink>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-stone-100 flex items-center justify-between px-8 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleSidebar}
              className="p-1 -ml-1 text-stone-500 rounded-md lg:hidden hover:bg-stone-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium text-stone-500 italic hidden md:block">
                Aura Semijoias / <span className="text-stone-900 font-bold not-italic">{(navItems.find(i => location.pathname.startsWith(i.path)) ?? navItems[0])?.label || 'Dashboard'}</span>
              </div>
              <div className="md:hidden text-stone-900 font-bold">
                {(navItems.find(i => location.pathname.startsWith(i.path)) ?? navItems[0])?.label || 'Dashboard'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-right">
              <div>
                <div className="text-xs font-bold text-stone-900">{user?.nome || 'Usuário'}</div>
                <div className="text-[10px] text-stone-400">{user?.perfil}</div>
              </div>
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                <User className="w-4 h-4 text-brand-600" />
              </div>
            </div>
            <button onClick={signOut} className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto h-full">
             <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
