const express = require('express')
const mysql = require('mysql2')
require('dotenv').config()

const app = express()
app.use(express.json())

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
})

db.connect((err) => {
  if (err) {
    console.error('Error de conexión: ', err.stack)
    return
  }
  console.log('Conectado a la base de datos')
})

app.get('/', (req, res) => {
  res.send('¡Backend funcionando!')
})

app.listen(process.env.PORT, () => {
  console.log(`Servidor ejecutándose en el puerto ${process.env.PORT}`)
})
