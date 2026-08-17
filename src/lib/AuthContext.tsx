import { supabase } from './supabase'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { PerfilTipo } from './permissions'

type User = {
  id: string
  email: string
  nome: string
  perfil: PerfilTipo
}

type AuthContextType = {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signIn: async () => null,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchPerfil(authId: string, email: string) {
    let { data } = await supabase
      .from('perfis')
      .select('*')
      .eq('id', authId)
      .single()

    if (data && data.ativo !== false) {
      setUser({
        id: authId,
        email,
        nome: data.nome,
        perfil: data.perfil as PerfilTipo,
      })
    } else {
      setUser(null)
    }
  }

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await fetchPerfil(session.user.id, session.user.email || '')
      }
      setLoading(false)
    }

    void loadSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        void fetchPerfil(session.user.id, session.user.email || '')
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return error.message
    return null
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
