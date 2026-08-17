import { createClient } from '@supabase/supabase-js'

const KEEP_ALIVE_QUERIES = 3

function isAuthorized(req) {
  const cronSecret = process.env.CRON_SECRET
  return Boolean(cronSecret && req.headers.authorization === `Bearer ${cronSecret}`)
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Keep-alive: Supabase environment variables are missing')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  for (let attempt = 1; attempt <= KEEP_ALIVE_QUERIES; attempt += 1) {
    const { error } = await supabase.from('perfis').select('id').limit(1)

    if (error) {
      console.error(`Keep-alive: database query ${attempt} failed`, error.message)
      return res.status(503).json({ error: 'Database unavailable', attempt })
    }
  }

  return res.status(200).json({ ok: true, queries: KEEP_ALIVE_QUERIES })
}
