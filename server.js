require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'formulario.html'));
});

app.post('/enviar', async (req, res) => {
  try {
    const datos = req.body;

    // 1. Guardar al participante
    const edad = parseInt(datos.edad, 10);
    const part = await pool.query(
      'insert into participantes (nombre, edad, nivel) values ($1, $2, $3) returning id',
      [datos.nombre || '', isNaN(edad) ? null : edad, datos.saber || '']
    );
    const participanteId = part.rows[0].id;

    // 2. Traer las respuestas correctas de la base de datos
    const preguntas = await pool.query('select id, respuesta_correcta from preguntas order by id');

    // 3. Comparar y guardar cada respuesta
    let aciertos = 0;
    for (const p of preguntas.rows) {
      const dada = (datos['respuesta' + p.id] || '').trim().toLowerCase();
      const correcta = p.respuesta_correcta.trim().toLowerCase();
      const esCorrecta = dada === correcta;
      if (esCorrecta) aciertos++;
      await pool.query(
        'insert into respuestas (participante_id, pregunta_id, respuesta, es_correcta) values ($1, $2, $3, $4)',
        [participanteId, p.id, dada, esCorrecta]
      );
    }

    const total = preguntas.rows.length;
    res.send(`
      <html lang="es"><head><meta charset="UTF-8"><title>Resultado</title>
      <link rel="stylesheet" href="estilos.css"></head>
      <body><center>
        <h1>¡Gracias, ${(datos.nombre || '').replace(/</g, '&lt;')}!</h1>
        <h3>Tu calificación: ${aciertos} de ${total} respuestas correctas</h3>
        <a href="/">Volver al formulario</a>
      </center></body></html>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al guardar las respuestas');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor listo en http://localhost:' + PORT));
