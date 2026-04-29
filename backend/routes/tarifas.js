const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/tarifas
router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.*, tv.nombre AS tipo_vehiculo
      FROM tarifas t
      JOIN tipos_vehiculo tv ON t.tipo_vehiculo_id = tv.id
      ORDER BY tv.nombre, t.fecha_inicio DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener tarifas.' });
  }
});

// POST /api/tarifas
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin } = req.body;
    if (!tipo_vehiculo_id || !nombre || !tipo_cobro || !valor || !fecha_inicio) {
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }
    if (isNaN(parseFloat(valor)) || parseFloat(valor) <= 0) {
      return res.status(400).json({ error: 'El valor debe ser un número positivo.' });
    }

    const [result] = await db.query(
      `INSERT INTO tarifas (tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin)
       VALUES (?,?,?,?,?,?)`,
      [tipo_vehiculo_id, nombre, tipo_cobro, valor, fecha_inicio, fecha_fin || null]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear tarifa.' });
  }
});

// PUT /api/tarifas/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nombre, tipo_cobro, valor, activo, fecha_inicio, fecha_fin } = req.body;
    await db.query(
      `UPDATE tarifas SET nombre=?, tipo_cobro=?, valor=?, activo=?, fecha_inicio=?, fecha_fin=?
       WHERE id=?`,
      [nombre, tipo_cobro, valor, activo ? 1 : 0, fecha_inicio, fecha_fin || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar tarifa.' });
  }
});

// DELETE /api/tarifas/:id  (desactivar)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await db.query(`UPDATE tarifas SET activo = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al desactivar tarifa.' });
  }
});

// GET /api/tarifas/tipos-vehiculo
router.get('/tipos-vehiculo', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM tipos_vehiculo ORDER BY nombre`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

module.exports = router;
