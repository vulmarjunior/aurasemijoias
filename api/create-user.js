import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Token ausente' })

  const token = auth.replace('Bearer ', '')
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Token inválido' })

  const { data: perfil } = await supabase.from('perfis').select('perfil').eq('id', user.id).single()
  if (!perfil || perfil.perfil !== 'ADMIN') return res.status(403).json({ error: 'Apenas ADMIN pode criar usuários' })

  const { email, password, nome, perfil: newPerfil = 'USER' } = req.body
  if (!email || !password || !nome) return res.status(400).json({ error: 'Campos obrigatórios: email, password, nome' })

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nome }
  })
  if (error) return res.status(500).json({ error: error.message })

  await supabase.from('perfis').upsert({
    id: data.user.id, nome, email, perfil: newPerfil
  })

  res.json({ success: true, id: data.user.id })
}
