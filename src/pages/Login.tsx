import { useAuth } from '../lib/AuthContext'
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'

export function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-stone-50"><div className="animate-spin w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full" /></div>
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setBusy(true)
    setError('')
    const err = await signIn(email, password)
    if (err) setError(err)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-8">
          <div className="text-center mb-8">
            <img src="/logo.jpg" alt="Aura Semijoias" className="h-16 w-auto object-contain mx-auto mb-3" />
            <h1 className="text-xl font-bold text-stone-900">Acessar Sistema</h1>
            <p className="text-sm text-stone-500 mt-1">Aura Semijoias</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" autoFocus className="w-full px-3 py-2.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-500 mb-1">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="w-full px-3 py-2.5 pr-10 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <button type="submit" disabled={busy || !email || !password} className="w-full px-4 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:bg-brand-400 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2">
              {busy ? 'Entrando...' : <><LogIn className="w-4 h-4" /> Entrar</>}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-stone-400 mt-4">Aura Semijoias — Sistema de Gestão</p>
      </div>
    </div>
  )
}
