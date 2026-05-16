import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Dashboard } from './pages/Dashboard';
import { Produtos } from './pages/Produtos';
import { Clientes } from './pages/Clientes';
import { Vendas } from './pages/Vendas';
import { Movimentacoes } from './pages/Movimentacoes';
import { Importar } from './pages/Importar';
import { Configuracoes } from './pages/Configuracoes';
import { Login } from './pages/Login';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="produtos" element={<Produtos />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="vendas" element={<Vendas />} />
          <Route path="movimentacoes" element={<Movimentacoes />} />
          <Route path="importar" element={<Importar />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
      </Route>
    </Routes>
  );
}
