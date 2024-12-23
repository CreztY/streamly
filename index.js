import express from 'express'
import pg from 'pg'
import cors from 'cors'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

const server = express()
server.use(express.json())

const corsOptions = {
  origin: 'http://streamly-deck.com',
  optionsSuccessStatus: 200
}

server.use(cors(corsOptions))

server.post('/api/login', async (req, res) => {
  const { uid, email, name } = req.body
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      await pool.query('INSERT INTO users (uid, email, name) VALUES ($1, $2, $3)', [uid, email, name || ''])
    }
    res.status(200).json({ message: 'Usuario registrado exitosamente' })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

server.post('/api/addbutton', async (req, res) => {
  const { uid, tabName, button } = req.body

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id

    // Obtener la pestaña del usuario
    let tabResult = await pool.query(
      'SELECT id FROM tabs WHERE user_id = $1 AND name = $2',
      [userId, tabName]
    )

    if (tabResult.rows.length === 0) {
      await pool.query('INSERT INTO tabs (user_id, name) VALUES ($1, $2) RETURNING id', [userId, tabName])
      tabResult = await pool.query(
        'SELECT id FROM tabs WHERE user_id = $1 AND name = $2',
        [userId, tabName]
      )
      if (tabResult.rows.length === 0) {
        return res.status(404).json({ error: 'Pestaña no encontrada' })
      }
    }

    const tabId = tabResult.rows[0].id

    // Insertar el nuevo botón
    await pool.query(
      `INSERT INTO buttons 
       (tab_id, function, image, name, scene_name, scene_collection_name, profile_name, sound, scene_item, scene_item_function)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        tabId,
        button.function,
        button.image,
        button.name,
        button.sceneName || null,
        button.sceneCollectionName || null,
        button.profileName || null,
        button.sound || null,
        button.sceneItem || null,
        button.sceneItemFunction || null
      ]
    )

    res.json({ message: 'Botón añadido correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al añadir botón' })
  }
})

server.get('/api/getbuttons', async (req, res) => {
  const { uid } = req.query
  console.log(uid)
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id
    const result = await pool.query(
      `SELECT b.* 
       FROM buttons b 
       INNER JOIN tabs t ON b.tab_id = t.id
       WHERE t.user_id = $1`,
      [userId]
    )

    console.log('result.rows: ', result.rows)
    res.json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los botones' })
  }
})

server.post('/api/import-buttons', async (req, res) => {
  const { uid, tabs } = req.body

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id

    // Eliminar pestañas y botones asociados
    await pool.query('DELETE FROM tabs WHERE user_id = $1', [userId])

    // Insertar nuevas pestañas y botones
    for (const tab of tabs) {
      const tabResult = await pool.query(
        'INSERT INTO tabs (user_id, name) VALUES ($1, $2) RETURNING id',
        [userId, tab.name]
      )
      const tabId = tabResult.rows[0].id

      for (const button of tab.buttons) {
        await pool.query(
          `INSERT INTO buttons 
           (tab_id, function, image, name, scene_name, scene_collection_name, profile_name, sound, scene_item, scene_item_function)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            tabId,
            button.function,
            button.image,
            button.name,
            button.sceneName || null,
            button.sceneCollectionName || null,
            button.profileName || null,
            button.sound || null,
            button.sceneItem || null,
            button.sceneItemFunction || null
          ]
        )
      }
    }

    res.json({ message: 'Botones importados correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al importar botones' })
  }
})

server.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor escuchando en http://localhost:${process.env.PORT || 3000}`)
})
