import express from 'express'
import pg from 'pg'
import cors from 'cors'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

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

server.post('/api/checkout', async (req, res) => {
  try {
    const { id } = req.body
    const payment = await stripe.paymentIntents.create({
      amount: 300,
      currency: 'eur',
      payment_method: id
    })

    console.log(payment)
    res.json({ message: 'Pago exitoso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al crear pago: ' + error.raw.message })
  }
})

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

    const insertResult = await pool.query(
      `INSERT INTO buttons 
       (tab_id, func, image, name, scene_name, scene_collection_name, profile_name, sound, scene_item, scene_item_function)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        tabId,
        button.func,
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

    const newButtonId = insertResult.rows[0].id
    res.json({ message: 'Botón añadido correctamente', buttonId: newButtonId })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al añadir botón' })
  }
})

server.post('/api/updatebutton', async (req, res) => {
  const { uid, currentTab, button } = req.body

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id

    // Obtener la pestaña del usuario
    const tabResult = await pool.query('SELECT id FROM tabs WHERE name = $1 AND user_id = $2', [currentTab, userId])
    if (tabResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pestaña no encontrada' })
    }

    const tabId = tabResult.rows[0].id

    // Actualizar el botón
    await pool.query(
      `UPDATE buttons 
       SET func = $1, image = $2, name = $3, scene_name = $4, scene_collection_name = $5, 
           profile_name = $6, sound = $7, scene_item = $8, scene_item_function = $9 
       WHERE id = $10 AND tab_id = $11`,
      [
        button.func,
        button.image,
        button.name,
        button.sceneName || null,
        button.sceneCollectionName || null,
        button.profileName || null,
        button.sound || null,
        button.sceneItem || null,
        button.sceneItemFunction || null,
        button.id,
        tabId
      ]
    )

    res.json({ message: 'Botón actualizado correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al actualizar el botón' })
  }
})

server.post('/api/removebutton', async (req, res) => {
  const { uid, tabName, id } = req.body

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id

    const tabResult = await pool.query('SELECT id FROM tabs WHERE name = $1 AND user_id = $2', [tabName, userId])
    if (tabResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pestaña no encontrada' })
    }

    const tabId = tabResult.rows[0].id

    await pool.query('DELETE FROM buttons WHERE tab_id = $1 AND id = $2', [tabId, id])

    res.json({ message: 'Botón eliminado correctamente' })

    const remainingButtons = await pool.query('SELECT id FROM buttons WHERE tab_id = $1 AND user_id = $2', [tabId, userId])
    if (remainingButtons.rows.length === 0) {
      await pool.query('DELETE FROM tabs WHERE id = $1 AND user_id = $2', [tabId, userId])
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar el botón' })
  }
})

server.post('/api/removetab', async (req, res) => {
  const { uid, tabName } = req.body

  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id

    // Obtener el ID de la pestaña
    const tabResult = await pool.query('SELECT id FROM tabs WHERE name = $1 AND user_id = $2', [tabName, userId])
    if (tabResult.rows.length === 0) {
      return res.status(404).json({ error: 'Pestaña no encontrada' })
    }

    const tabId = tabResult.rows[0].id

    // Eliminar los botones asociados a la pestaña
    await pool.query('DELETE FROM buttons WHERE tab_id = $1', [tabId])

    // Eliminar la pestaña
    await pool.query('DELETE FROM tabs WHERE id = $1', [tabId])

    res.json({ message: 'Pestaña eliminada correctamente' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al eliminar la pestaña' + error })
  }
})

server.get('/api/getbuttons', async (req, res) => {
  const { uid } = req.query
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id
    const result = await pool.query(
      `SELECT b.*, t.name as tab_name 
       FROM buttons b 
       INNER JOIN tabs t ON b.tab_id = t.id
       WHERE t.user_id = $1`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener los botones' + error })
  }
})

server.get('/api/getuserplan', async (req, res) => {
  const { uid } = req.query
  try {
    const userResult = await pool.query('SELECT id FROM users WHERE uid = $1', [uid])
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' })
    }

    const userId = userResult.rows[0].id
    const result = await pool.query('SELECT userplan FROM users WHERE user_id = $1', [userId])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plan de usuario no encontrado' })
    }
    res.json(result.rows)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error al obtener el plan' })
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
           (tab_id, func, image, name, scene_name, scene_collection_name, profile_name, sound, scene_item, scene_item_function)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            tabId,
            button.func,
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
