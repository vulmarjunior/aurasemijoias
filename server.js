import express from 'express'
import createUserHandler from './api/create-user.js'

const app = express()
const allowedOrigin = process.env.APP_URL || 'http://localhost:3000'
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})
app.use(express.json())

app.post('/api/create-user', createUserHandler)

const PORT = process.env.API_PORT || 3001
app.listen(PORT, () => console.log(`API server on :${PORT}`))
