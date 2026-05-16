import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config()

const app = express()
app.use(express.json())

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

async function verifyAdmin(token) {
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return null
  const { data: perfil } = await supabase.from('perfis').select('perfil').eq('id', user.id).single()
  if (!perfil || perfil.perfil !== 'ADMIN') return null
  return user
}

app.post('/api/create-user', async (req, res) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'Token ausente' })
  const admin = await verifyAdmin(auth.replace('Bearer ', ''))
  if (!admin) return res.status(403).json({ error: 'Apenas ADMIN pode criar usuários' })

  const { email, password, nome, perfil = 'USER' } = req.body
  if (!email || !password || !nome) return res.status(400).json({ error: 'Campos obrigatórios: email, password, nome' })

  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { nome }
  })
  if (error) return res.status(500).json({ error: error.message })

  await supabase.from('perfis').upsert({
    id: data.user.id, nome, email, perfil
  })

  res.json({ success: true, id: data.user.id })
})

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server on :${PORT}`))
