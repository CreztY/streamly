import express from 'express'
import pg from 'pg'
import admin from 'firebase-admin'
import dotenv from 'dotenv'

dotenv.config()

// Inicializar Firebase Admin SDK para la validación de tokens
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
})

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

const server = express()
server.use(express.json())

server.post('/api/login', async (req, res) => {
  const { idToken } = req.body
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    const uid = decodedToken.uid

    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      await pool.query('INSERT INTO users (uid, email, name) VALUES ($1, $2, $3)', [uid, decodedToken.email, decodedToken.name || ''])
    }

    res.json({ uid, email: decodedToken.email, name: decodedToken.name })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

server.get('/api/get-buttons', async (req, res) => {
  const { uid } = req.query
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }
    const userId = userResult.rows[0].id
    const result = await pool.query('SELECT * FROM buttons WHERE user_id = $1', [userId])
    res.json(result.rows)
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener los botones' })
  }
})

server.post('/api/add-button', async (req, res) => {
  const { uid, buttons } = req.body
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    const userId = userResult.rows[0].id

    for (const button of buttons) {
      await pool.query(
        'INSERT INTO buttons (user_id, function, image, name, profile_name, scene_name, scene_item) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [userId, button.function, button.image, button.name, button.profile_name, button.scene_name, button.scene_item]
      )
    }

    res.status(201).json({ message: 'Botones guardados exitosamente' })
  } catch (error) {
    res.status(500).json({ error: 'Error al guardar los botones' })
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor escuchando en http://localhost:${process.env.PORT || 3000}`)
})
