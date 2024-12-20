import express from 'express'
import pg from 'pg'

// Conectar a la base de datos
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: true
})

// Crear una nueva aplicación Express
const app = express()

// Definir un puerto para nuestro servidor
const port = process.env.PORT || 3000

// Definir una ruta de prueba
app.get('/', (req, res) => {
  res.send('¡Hola Mundo!')
})

app.get('/ping', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM streamlydb')
    return res.json(result)
  } catch (error) {
    return res.status(500).json({ error: 'Error de conexión a la base de datos' })
  }
})

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`)
})
