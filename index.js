import express from 'express'
import { config } from 'dotenv'
import pg from 'pg'

const app = express()
app.use(express.json())

config()

const pool = new pg.Pool({
  connectionString: process.env.EXTERNAL_IP
})

app.get('/', async (req, res) => {
  const result = await pool.query('SELECT NOW()')
  return res.json(result)
})

app.listen(process.env.PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${process.env.PORT}`)
})
