const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/usuarios
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT u.id, u.nombre, u.email, r.nombre AS rol, u.activo, u.fecha_creacion
      FROM usuarios u JOIN roles r ON u.rol_id = r.id
      ORDER BY u.fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener usuarios.' });
  }
});

// POST /api/usuarios
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener mínimo 4 caracteres.' });
    }

    const [existe] = await db.query(`SELECT id FROM usuarios WHERE email = ?`, [email.trim().toLowerCase()]);
    if (existe.length) {
      return res.status(400).json({ error: 'El correo ya está registrado.' });
    }

    const [[rolRow]] = await db.query(`SELECT id FROM roles WHERE nombre = ?`, [rol]);
    if (!rolRow) return res.status(400).json({ error: 'Rol no válido.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol_id) VALUES (?,?,?,?)`,
      [nombre.trim(), email.trim().toLowerCase(), hash, rolRow.id]
    );
    res.json({ ok: true, id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario.' });
  }
});

// PUT /api/usuarios/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nombre, email, rol, activo, password } = req.body;
    const [[rolRow]] = await db.query(`SELECT id FROM roles WHERE nombre = ?`, [rol]);
    if (!rolRow) return res.status(400).json({ error: 'Rol no válido.' });

    if (password && password.length >= 4) {
      const hash = await bcrypt.hash(password, 10);
      await db.query(
        `UPDATE usuarios SET nombre=?, email=?, rol_id=?, activo=?, password_hash=? WHERE id=?`,
        [nombre, email.trim().toLowerCase(), rolRow.id, activo ? 1 : 0, hash, req.params.id]
      );
    } else {
      await db.query(
        `UPDATE usuarios SET nombre=?, email=?, rol_id=?, activo=? WHERE id=?`,
        [nombre, email.trim().toLowerCase(), rolRow.id, activo ? 1 : 0, req.params.id]
      );
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// DELETE /api/usuarios/:id  (desactivar)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.session.user.id) {
      return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
    }
    await db.query(`UPDATE usuarios SET activo = 0 WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar usuario.' });
  }
});

// GET /api/usuarios/roles
router.get('/roles', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT * FROM roles`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error.' });
  }
});

module.exports = router;
