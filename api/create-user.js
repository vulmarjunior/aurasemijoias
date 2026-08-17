import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const PERFIS_VALIDOS = ['ADMIN', 'USER', 'VIEWER']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token ausente ou inválido' })

  const token = auth.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await supabase.from('perfis').select('perfil, ativo').eq('id', user.id).single()
  if (!perfil || perfil.perfil !== 'ADMIN' || perfil.ativo === false) return res.status(403).json({ error: 'Apenas ADMIN ativo pode criar usuários' })

  const { email, password, nome, perfil: newPerfil = 'USER' } = req.body
  if (!email || !password || !nome) return res.status(400).json({ error: 'Campos obrigatórios: email, password, nome' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email inválido' })
  if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' })
  if (!PERFIS_VALIDOS.includes(newPerfil)) return res.status(400).json({ error: `Perfil inválido. Permitidos: ${PERFIS_VALIDOS.join(', ')}` })

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nome }
  })
  if (error) return res.status(500).json({ error: error.message })

  const { error: perfilError } = await supabase.from('perfis').upsert({
    id: data.user.id, nome, email, perfil: newPerfil
  })
  if (perfilError) {
    await supabase.auth.admin.deleteUser(data.user.id)
    return res.status(500).json({ error: 'Não foi possível criar o perfil do usuário' })
  }

  return res.json({ success: true, id: data.user.id })
}
