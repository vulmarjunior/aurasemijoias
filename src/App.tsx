import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })));
const Produtos = lazy(() => import('./pages/Produtos').then(module => ({ default: module.Produtos })));
const Clientes = lazy(() => import('./pages/Clientes').then(module => ({ default: module.Clientes })));
const Vendas = lazy(() => import('./pages/Vendas').then(module => ({ default: module.Vendas })));
const Movimentacoes = lazy(() => import('./pages/Movimentacoes').then(module => ({ default: module.Movimentacoes })));
const Inventarios = lazy(() => import('./pages/Inventarios').then(module => ({ default: module.Inventarios })));
const Importar = lazy(() => import('./pages/Importar').then(module => ({ default: module.Importar })));
const Configuracoes = lazy(() => import('./pages/Configuracoes').then(module => ({ default: module.Configuracoes })));
const Faq = lazy(() => import('./pages/Faq').then(module => ({ default: module.Faq })));
const Login = lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Offline = lazy(() => import('./pages/Offline').then(module => ({ default: module.Offline })));

function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/offline" element={<Offline />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="produtos" element={<Produtos />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="vendas" element={<Vendas />} />
            <Route path="movimentacoes" element={<Movimentacoes />} />
            <Route path="inventarios" element={<Inventarios />} />
            <Route path="importar" element={<Importar />} />
            <Route path="configuracoes" element={<Configuracoes />} />
            <Route path="faq" element={<Faq />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
