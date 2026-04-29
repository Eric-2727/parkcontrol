const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const db      = require('../config/db');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    }

    const [rows] = await db.query(
      `SELECT u.*, r.nombre AS rol
       FROM usuarios u
       JOIN roles r ON u.rol_id = r.id
       WHERE u.email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = rows[0];

    if (!user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo. Contacta al administrador.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    req.session.user = {
      id:     user.id,
      nombre: user.nombre,
      email:  user.email,
      rol:    user.rol
    };

    return res.json({
      ok: true,
      user: req.session.user
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ error: 'Error al cerrar sesión.' });
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'No autenticado.' });
  }
  res.json({ ok: true, user: req.session.user });
});

module.exports = router;
